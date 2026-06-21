import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { transformEventForFrontend } from '~/server/utils/eventsTransform'
import { resolveAccountTitle } from '~/server/utils/accountScope'
import { getTimeInIsraelFromIso } from '~/utils/israelDate'

/**
 * Notify the approving manager when an event becomes active (draft → published) on the
 * web, asking the wa-bot to send the SAME "new event added" message + delete button it
 * sends for bot-created events (so approver moderation is identical for both sources).
 *
 * Best-effort: publishing already succeeded, so a delivery failure is logged, never
 * thrown. On success it stamps `approverNotifiedAt` on the event so it's surfaced to the
 * approver only ONCE — re-publishing a previously-published event won't re-notify. In dev
 * / when WA_BOT_URL is unset it just logs (no approver hop configured).
 *
 * @param doc - the event document (pre-update is fine; only `event`/`_id` are read)
 */
export async function notifyApproverOfEventActivation(doc: any): Promise<void> {
  const config = useRuntimeConfig() as Record<string, any>
  const botUrl = (config.waBotUrl || process.env.WA_BOT_URL || '').replace(/\/$/, '')
  const apiSecret = config.apiSecret || process.env.API_SECRET || ''

  const ev = transformEventForFrontend(doc)
  if (!ev) return
  const eventId = String(ev.id)

  const { db } = await getMongoConnection()

  // Resolve publisher name + account title (best-effort — notify with whatever we have).
  let publisherName = ''
  let publishingAs = ''
  let publisherPhone = typeof ev.publisherPhone === 'string' ? ev.publisherPhone : ''
  const publisherId = typeof ev.publisherId === 'string' ? ev.publisherId : ''
  if (publisherId) {
    try {
      const pubCol = db.collection(config.mongodbCollectionPublishers || 'publishers')
      const pub = await pubCol.findOne(
        { _id: new ObjectId(publisherId) },
        { projection: { fullName: 1, waId: 1, accountId: 1, accountName: 1 } },
      )
      if (pub) {
        publisherName = typeof pub.fullName === 'string' ? pub.fullName : ''
        publishingAs = await resolveAccountTitle({ accountId: pub.accountId, accountName: pub.accountName, waId: pub.waId })
        if (!publisherPhone && typeof pub.waId === 'string') publisherPhone = pub.waId
      }
    } catch {
      // invalid id / lookup failure → notify with whatever we already have
    }
  }

  const body = buildBody(ev, eventId, publisherName, publishingAs, publisherPhone, config)

  if (!botUrl) {
    console.info(`[events] WA_BOT_URL unset — approver not notified for event ${eventId} (dev or not configured)`)
    return
  }
  try {
    await $fetch(`${botUrl}/internal/notify-approver-event`, {
      method: 'POST',
      headers: { 'x-api-secret': apiSecret },
      body: { eventId, body, publisherPhone, eventTitle: ev.title },
      timeout: 15000,
    })
    // Mark as surfaced so a later re-publish of the same event doesn't re-notify.
    const eventsCol = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')
    await eventsCol.updateOne({ _id: doc._id }, { $set: { approverNotifiedAt: new Date() } })
  } catch (err) {
    console.error('[events] approver event notify failed:', err instanceof Error ? err.message : String(err))
  }
}

/** 'YYYY-MM-DD' → 'D.M' (e.g. 2026-03-07 → 7.3). */
function formatDateDotted(yyyymmdd?: string): string {
  const s = String(yyyymmdd || '').slice(0, 10)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${parseInt(m[3], 10)}.${parseInt(m[2], 10)}` : ''
}

/** Time line for one occurrence: 'כל היום' / 'HH:mm' / 'HH:mm-HH:mm' (Israel TZ). */
function formatTime(occ: any): string {
  if (!occ || occ.hasTime === false) return 'כל היום'
  const start = occ.startTime ? getTimeInIsraelFromIso(occ.startTime) : ''
  if (!start) return ''
  if (occ.endTime) {
    const end = getTimeInIsraelFromIso(occ.endTime)
    if (end) return `${start}-${end}`
  }
  return start
}

/** Mirror of the wa-bot's approver "new event" body (consts EVENT_NOTIFICATION_HEADING). */
function buildBody(
  ev: any,
  eventId: string,
  publisherName: string,
  publishingAs: string,
  publisherPhone: string,
  config: Record<string, any>,
): string {
  const title = typeof ev.title === 'string' && ev.title ? ev.title : '-'
  const rawDesc = typeof ev.shortDescription === 'string' ? ev.shortDescription : ''
  const shortDesc = rawDesc ? (rawDesc.length > 200 ? rawDesc.slice(0, 197) + '...' : rawDesc) : '-'
  const occ = Array.isArray(ev.occurrences) ? ev.occurrences[0] : null
  const dateStr = occ?.date ? formatDateDotted(occ.date) : ''
  const timeStr = formatTime(occ)
  const dateTime = [dateStr, timeStr].filter(Boolean).join(' ').trim() || '-'
  const loc = ev.location || {}
  const locParts: string[] = []
  if (typeof loc.locationName === 'string' && loc.locationName.trim()) locParts.push(loc.locationName.trim())
  if (typeof loc.city === 'string' && loc.city.trim()) locParts.push(loc.city.trim())
  const location = locParts.length ? locParts.join(', ') : 'לא ידוע'
  const priceNum = typeof ev.price === 'number' ? ev.price : NaN
  const price = Number.isNaN(priceNum) ? 'לא ידוע' : priceNum === 0 ? 'חינם' : `${priceNum} ₪`
  const siteUrl = (config.public?.siteUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  const eventLink = `${siteUrl}/direct?event=${encodeURIComponent(eventId)}`

  const lines = [
    '*אירוע חדש נוסף למערכת*',
    `*שם:* ${title}`,
    `*תיאור קצר:* ${shortDesc}`,
    `*תאריך:* ${dateTime}`,
    `*מיקום:* ${location}`,
    `*מחיר:* ${price}`,
  ]
  if (publisherName) lines.push(`*מפרסם:* ${publisherName}`)
  if (publishingAs) lines.push(`*מטעם:* ${publishingAs}`)
  if (publisherPhone) lines.push(`*טלפון:* ${publisherPhone}`)
  lines.push('', eventLink, `מזהה: ${eventId}`)
  return lines.join('\n')
}

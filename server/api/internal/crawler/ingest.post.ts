import { createHash } from 'node:crypto'
import { detectEventFromFreeText, extractEventFromFreeText } from '@galiluz/event-format'
import { requireApiSecret } from '~/server/utils/requireApiSecret'
import { getMongoConnection } from '~/server/utils/mongodb'
import { getAppSetting } from '~/server/utils/appSettings'
import { getPublisherPreferences } from '~/server/utils/publisherPreferences'
import { getAccountPublisherIds, resolveAccountTitle } from '~/server/utils/accountScope'
import { getTodayIsrael } from '~/server/utils/eventFirstOccurrence'
import { NOT_DELETED } from '~/server/utils/eventsQuery'
import { sanitizeMessageForPrompt } from '~/server/utils/sanitizeMessageForPrompt'
import { matchCrawlerEvent } from '~/server/utils/crawlerEventMatch'
import { buildCrawlerDraftEvent } from '~/server/utils/buildCrawlerDraft'
import { uploadBufferToCloudinary } from '~/server/utils/cloudinary'
import { safeFetchImage } from '~/server/utils/safeImageFetch'
import { issueMagicLink } from '~/server/utils/magicLink'
import { maybeSweepExpiredCrawlerDrafts } from '~/server/utils/crawlerCleanup'
import { logEventCreation } from '~/server/utils/eventLogs.service'
import { getCategoriesList } from '~/consts/events.const.js'
import { CITIES as CITIES_MAP } from '~/consts/regions.const.js'

const CITIES_LIST = Object.entries(CITIES_MAP).map(([id, c]) => ({
  id,
  title: (c as { title: string }).title,
  region: (c as { region: string }).region,
}))

function normalizePhone(raw: string): string | null {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.startsWith('972') && digits.length === 12) return digits
  if (digits.startsWith('05') && digits.length === 10) return '972' + digits.slice(1)
  if (digits.startsWith('5') && digits.length === 9) return '972' + digits
  return digits.length >= 11 ? digits : null
}

function textHashOf(text: string): string {
  return createHash('sha256').update(text.trim().replace(/\s+/g, ' ')).digest('hex')
}

const skip = (reason: string) => ({ processed: false, reason })

// Cap dup-match candidates to bound the AI prompt size.
const MAX_MATCH_CANDIDATES = 40

function buildCrawlerNotification(name: string, title: string, link: string): string {
  // WhatsApp bold = *text*; the opening * must sit at a word boundary to render.
  return [
    name ? `היי *${name}*,` : 'היי,',
    'שמנו לב שפרסמת אירוע חדש בקבוצת וואטסאפ:',
    `*${title}*`,
    '',
    'בואו נעלה אותו יחד לגלילו"ז',
    `יצרנו אותו בשבילך במערכת כדי *שכל מה שתצטרך/י לעשות זה לעבור על הפרטים וללחוץ על 'פרסום'!*`,
    '',
    'הנה הלינק הישיר לפרטי האירוע באיזור האישי שלך – אל תעבירו אותו לאף אחד אחר',
    link,
  ].join('\n')
}

/** Approver heads-up about a new crawler draft (plain gateway message). */
function buildApproverDraftNotification(d: {
  title: string; account: string; publisherName: string; phone: string; eventId: string; groupName: string
}): string {
  return [
    'טיוטה חדשה נוצרה על ידי הבוט',
    `*${d.title || '-'}*`,
    `חשבון: ${d.account || '-'}`,
    `מפרסם: ${d.publisherName || '-'}`,
    `טלפון: ${d.phone || '-'}`,
    `מזהה אירוע: ${d.eventId}`,
    `חולץ מהקבוצה: ${d.groupName || '-'}`,
  ].join('\n')
}

/**
 * Internal (API_SECRET): the WhatsApp crawler pipeline. Receives a parsed group
 * message from the gateway and, for opted-in approved publishers posting a NEW
 * event in a watched group, creates a draft. Each guard returns 200 with a
 * reason (never throws) so the gateway's fire-and-forget call can't error-loop.
 */
export default defineEventHandler(async (event) => {
  requireApiSecret(event)

  // Opportunistic cleanup: silently soft-delete crawler drafts never published within
  // a week. Throttled (≤1/h) + fire-and-forget, so it rides normal crawler traffic
  // without a separate scheduler and never delays this request.
  maybeSweepExpiredCrawlerDrafts()

  const body = await readBody<{ groupChatId?: string; senderPhone?: string; text?: string; imageUrl?: string; mimeType?: string; idMessage?: string }>(event)
  const groupChatId = String(body?.groupChatId || '')
  const rawText = sanitizeMessageForPrompt(body?.text || '')
  const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl : ''
  const correlationId = String(body?.idMessage || '').slice(0, 32) || createHash('sha1').update(groupChatId + rawText).digest('hex').slice(0, 12)

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()

  // 1 + 2. Crawler enabled + group watched.
  const crawler = await getAppSetting('crawler')
  if (crawler?.enabled !== true) return skip('crawler_disabled')
  const watched = Array.isArray(crawler.groups) ? (crawler.groups as Array<{ chatId?: string }>).map((g) => g.chatId) : []
  if (!groupChatId.endsWith('@g.us') || !watched.includes(groupChatId)) return skip('group_not_watched')

  // 3. Sender must be an approved, non-ghost, opted-in publisher.
  const waId = normalizePhone(body?.senderPhone || '')
  if (!waId) return skip('bad_sender')
  const publishers = db.collection(config.mongodbCollectionPublishers || 'publishers')
  const publisher = await publishers.findOne({ waId }, { projection: { status: 1, accountId: 1, accountName: 1, fullName: 1, preferences: 1 } })
  if (!publisher || publisher.status !== 'approved') return skip('publisher_not_eligible')
  if (getPublisherPreferences(publisher).autoGenerateDraftsByCrawler !== true) return skip('publisher_not_opted_in')
  const publisherId = publisher._id.toString()

  if (!rawText) return skip('no_text')

  // 4. Dedup: exact-duplicate by (publisher, text hash) within the TTL window (21d).
  // The message is recorded as "seen" only AFTER a definitive verdict (genuine
  // non-event, deterministic failure, or a created draft) — a transient AI/transport
  // error must NOT poison this window and silently suppress a real event on re-post.
  const hash = textHashOf(rawText)
  const crawlerMessages = db.collection(config.mongodbCollectionCrawlerMessages || 'crawlerMessages')
  if (await crawlerMessages.findOne({ publisherId, textHash: hash })) return skip('duplicate')
  const recordSeen = () => crawlerMessages.updateOne(
    { publisherId, textHash: hash },
    { $setOnInsert: { publisherId, groupChatId, textHash: hash, createdAt: new Date() } },
    { upsert: true },
  )

  const openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY
  const openaiModel = (process.env.OPENAI_MODEL_WEB || 'gpt-4o').trim() || 'gpt-4o'

  // 5. Is this an event? (relaxed; accepts partial detail.) A transient AI/transport
  // error aborts WITHOUT recording, so the same message can be re-evaluated on re-post.
  const detection = await detectEventFromFreeText(rawText, { openaiApiKey, openaiModel, correlationId })
  if (detection?.transient) return skip(`detect_error:${detection.reason || 'n/a'}`)
  if (!detection?.isEvent) { await recordSeen(); return skip(`not_event:${detection?.reason || 'n/a'}`) }

  // 6. Extract structured event. Transient errors abort without recording; a
  // deterministic failure is a final verdict, so record it to avoid reprocessing.
  const { formattedEvent, errorReason, transient } = await extractEventFromFreeText(rawText, getCategoriesList(), CITIES_LIST, { openaiApiKey, openaiModel })
  if (transient) return skip(`extract_error:${errorReason || 'n/a'}`)
  if (errorReason || !formattedEvent) { await recordSeen(); return skip(`extract_failed:${errorReason || 'n/a'}`) }

  // A real event was extracted — record it so a re-post doesn't reprocess it.
  await recordSeen()

  // Abort if the event already happened: when the AI extracted occurrences and ALL of
  // them are in the past, there's nothing to publish. No occurrences at all → continue
  // (the publisher can fill in the date); any future occurrence → continue.
  const today = getTodayIsrael()
  const occurrenceDates = ((formattedEvent.occurrences || []) as Array<{ date?: string }>)
    .map((o) => o.date)
    .filter(Boolean) as string[]
  if (occurrenceDates.length && occurrenceDates.every((dt) => dt < today)) {
    return skip('event_in_past')
  }

  // 7. Skip if it matches an existing FUTURE event in the account (published OR draft).
  // The AI makes the semantic same/different call from title + description + idea.
  const publisherIds = await getAccountPublisherIds({ accountId: publisher.accountId, publisherId } as never)
  const eventsCol = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')
  const accountEvents = await eventsCol
    .find(
      { 'event.publisherId': { $in: publisherIds }, ...NOT_DELETED },
      { projection: { 'event.Title': 1, 'event.shortDescription': 1, 'event.location.city': 1, 'event.occurrences': 1 } },
    )
    .toArray()
  const candidates = accountEvents
    .map((d: any) => {
      const future = (d.event?.occurrences || []).map((o: any) => o.date).filter((dt: string) => dt && dt >= today).sort()[0]
      return future
        ? { id: d._id.toString(), title: d.event?.Title || '', city: d.event?.location?.city || '', date: future, shortDescription: d.event?.shortDescription || '' }
        : null
    })
    .filter(Boolean)
    .slice(0, MAX_MATCH_CANDIDATES) as Array<{ id: string; title: string; city: string; date: string; shortDescription: string }>

  const match = await matchCrawlerEvent(formattedEvent, candidates, rawText, { openaiApiKey, openaiModel, correlationId })
  if (match.matchedId) return skip(`already_exists:${match.matchedId}`)

  // 8. Upload the message image (if any) to Cloudinary. The URL is sourced from
  // Green API and forwarded by the gateway — fetch it through the SSRF-hardened
  // helper (https-only, no private/reserved IPs, redirect re-validation, size cap)
  // rather than a bare fetch, so a manipulated URL can't reach internal hosts.
  let media: unknown[] = []
  if (imageUrl) {
    try {
      const { buffer, contentType } = await safeFetchImage(imageUrl)
      const mimetype = body?.mimeType || contentType || 'image/jpeg'
      const uploaded = await uploadBufferToCloudinary(
        buffer, `crawler-${correlationId}`, mimetype,
        config.cloudinaryFolder || 'wa-bot-events',
        config.cloudinaryCloudName, config.cloudinaryApiKey, config.cloudinaryApiSecret,
      )
      if (uploaded) {
        media = [{
          cloudinaryURL: uploaded.secure_url,
          cloudinaryData: { public_id: uploaded.public_id, resource_type: uploaded.resource_type, format: uploaded.format, width: uploaded.width, height: uploaded.height, bytes: uploaded.bytes },
          isMain: true,
        }]
      }
    } catch (err) {
      console.error('[crawler/ingest] image fetch/upload failed:', err instanceof Error ? err.message : String(err))
    }
  }

  // 9. Build + save the draft (validDraft flags completeness; never rejected).
  const { eventObj, validDraft } = buildCrawlerDraftEvent(formattedEvent, publisherId, media)
  const doc = {
    createdAt: new Date(),
    isActive: false,
    validDraft,
    // Marks the event as crawler-created (for statistics + the unpublished-draft
    // cleanup sweep). rawEvent.source carries the same signal as the source convention.
    createdByCrawler: true,
    event: eventObj,
    rawEvent: { publisherId, source: 'whatsapp_crawler', rawText, groupChatId },
  }
  const result = await eventsCol.insertOne(doc)
  const draftId = result.insertedId.toString()

  await logEventCreation({
    eventId: draftId,
    action: 'draft_created',
    title: String(eventObj.Title || ''),
    publisherId,
    waId,
    correlationId,
  })

  console.info(`[crawler/ingest] draft created ${draftId} for ${waId} (validDraft=${validDraft})`)

  // Issue a single-use magic link + notify the publisher on WhatsApp (best-effort;
  // the draft is already saved, so a notification failure must not fail the request).
  let notified = false
  try {
    // `?modal=edit` makes the details page open the edit modal on arrival
    // (EventDetailView reads route.query.modal) — the publisher lands ready to review.
    const link = await issueMagicLink(publisherId, `/publisher/events/${draftId}?modal=edit`)
    const gatewayUrl = (config.waGatewayUrl || process.env.WA_GATEWAY_URL || '').replace(/\/$/, '')
    const apiSecret = config.apiSecret || process.env.API_SECRET || ''
    // Dev convenience (mirrors the OTP terminal print): surface the link so it can
    // be tested without a reachable gateway. Never log it in production.
    if (link && process.env.NODE_ENV !== 'production') {
      console.info(`[Crawler][DEV] Magic link for ${waId}: ${link}`)
    }
    if (link && gatewayUrl) {
      const message = buildCrawlerNotification(String(publisher.fullName || ''), String(eventObj.Title || ''), link)
      await $fetch(`${gatewayUrl}/internal/send-message`, {
        method: 'POST',
        headers: { 'x-api-secret': apiSecret },
        body: { phone: waId, message },
        timeout: 15000,
      })
      notified = true

      // Only AFTER the publisher was notified, surface the draft to the approver too
      // (plain gateway message; best-effort — its own catch keeps it from affecting the request).
      const approverPhone = normalizePhone(config.publishersApproverWaNumber || process.env.PUBLISHERS_APPROVER_WA_NUMBER || '')
      if (approverPhone) {
        const account = await resolveAccountTitle({ accountId: publisher.accountId, accountName: publisher.accountName, waId })
        const groupName =
          (Array.isArray(crawler.groups)
            ? (crawler.groups as Array<{ chatId?: string; name?: string }>).find((g) => g.chatId === groupChatId)?.name
            : '') || groupChatId
        const approverMsg = buildApproverDraftNotification({
          title: String(eventObj.Title || ''),
          account,
          publisherName: String(publisher.fullName || ''),
          phone: waId,
          eventId: draftId,
          groupName,
        })
        await $fetch(`${gatewayUrl}/internal/send-message`, {
          method: 'POST',
          headers: { 'x-api-secret': apiSecret },
          body: { phone: approverPhone, message: approverMsg },
          timeout: 15000,
        }).catch((err) => console.error('[crawler/ingest] approver notify failed:', err instanceof Error ? err.message : String(err)))
      }
    }
  } catch (err) {
    console.error('[crawler/ingest] notify failed:', err instanceof Error ? err.message : String(err))
  }

  return {
    processed: true,
    draftId,
    title: String(eventObj.Title || ''),
    validDraft,
    notified,
    publisherId,
    publisherName: publisher.fullName || '',
    waId,
  }
})


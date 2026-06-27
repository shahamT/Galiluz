import { createHash } from 'node:crypto'
import { detectEventFromFreeText, extractEventFromFreeText } from '@galiluz/event-format'
import { requireApiSecret } from '~/server/utils/requireApiSecret'
import { getMongoConnection } from '~/server/utils/mongodb'
import { getAppSetting } from '~/server/utils/appSettings'
import { getPublisherPreferences } from '~/server/utils/publisherPreferences'
import { resolveAccountTitle, ensureAccountForPublisher } from '~/server/utils/accountScope'
import { getTodayIsrael } from '~/server/utils/eventFirstOccurrence'
import { NOT_DELETED } from '~/server/utils/eventsQuery'
import { sanitizeMessageForPrompt } from '~/server/utils/sanitizeMessageForPrompt'
import { matchCrawlerEvent } from '~/server/utils/crawlerEventMatch'
import { buildCrawlerDraftEvent } from '~/server/utils/buildCrawlerDraft'
import { uploadBufferToCloudinary } from '~/server/utils/cloudinary'
import { safeFetchImage } from '~/server/utils/safeImageFetch'
import { issueMagicLink } from '~/server/utils/magicLink'
import { notifyLog } from '~/server/utils/notifyLog'
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

// Below this, a message can't carry meaningful event detail — drop it before any DB/AI work.
const MIN_CRAWLER_TEXT_LENGTH = 70

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

  // Cheapest gate first: a sub-70-char message can't hold meaningful event detail.
  // Skip before any DB/AI work. (Also catches empty text.)
  if (rawText.length < MIN_CRAWLER_TEXT_LENGTH) return skip('too_short')

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()

  // 1 + 2. Crawler enabled + group watched.
  const crawler = await getAppSetting('crawler')
  if (crawler?.enabled !== true) return skip('crawler_disabled')
  const watched = Array.isArray(crawler.groups) ? (crawler.groups as Array<{ chatId?: string }>).map((g) => g.chatId) : []
  if (!groupChatId.endsWith('@g.us') || !watched.includes(groupChatId)) return skip('group_not_watched')
  const groupName =
    (Array.isArray(crawler.groups)
      ? (crawler.groups as Array<{ chatId?: string; name?: string }>).find((g) => g.chatId === groupChatId)?.name
      : '') || groupChatId

  // 3. Sender must be an approved, non-ghost, opted-in publisher.
  const waId = normalizePhone(body?.senderPhone || '')
  if (!waId) return skip('bad_sender')
  const publishers = db.collection(config.mongodbCollectionPublishers || 'publishers')
  const publisher = await publishers.findOne({ waId }, { projection: { status: 1, accountId: 1, accountName: 1, fullName: 1, preferences: 1 } })
  if (!publisher || publisher.status !== 'approved') return skip('publisher_not_eligible')
  if (getPublisherPreferences(publisher).autoGenerateDraftsByCrawler !== true) return skip('publisher_not_opted_in')
  const publisherId = publisher._id.toString()

  // 4. Dedup: exact-duplicate by (publisher, text hash) within the TTL window (21d).
  // Claim the (publisher, text) ATOMICALLY up front by inserting the record — the unique
  // index makes a second concurrent insert fail with E11000, so a double-delivered webhook
  // (Green API is at-least-once) can't create two drafts. A transient AI/transport error
  // RELEASES the claim (deleteOne) so a genuine re-post is still re-evaluated; all other
  // verdicts (non-event, deterministic failure, created draft) keep the claim.
  const hash = textHashOf(rawText)
  const crawlerMessages = db.collection(config.mongodbCollectionCrawlerMessages || 'crawlerMessages')
  try {
    await crawlerMessages.insertOne({ publisherId, groupChatId, textHash: hash, createdAt: new Date() })
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) return skip('duplicate')
    throw err
  }
  const releaseClaim = () => crawlerMessages.deleteOne({ publisherId, textHash: hash }).catch(() => {})

  const openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY
  const openaiModel = (process.env.OPENAI_MODEL_WEB || 'gpt-4o').trim() || 'gpt-4o'

  // Crawler AI-decision logging (PRODUCTION ONLY, opt-in via the crawler page). For every message
  // that reached the AI stage (passed the publisher / not-too-short / not-duplicate filters), post
  // the message + the AI's verdict + reason to the selected "crawler log" group. Best-effort.
  const decisionLogChatId =
    process.env.NODE_ENV === 'production' && crawler.logDecisions === true && typeof crawler.logGroupChatId === 'string'
      ? (crawler.logGroupChatId as string)
      : ''
  const logDecision = async (verdict: string, detail = '') => {
    if (!decisionLogChatId) return
    const snippet = rawText.length > 500 ? `${rawText.slice(0, 500)}…` : rawText
    const msg = [
      '🔎 *קראולר — החלטת AI*',
      `קבוצה: ${groupName}`,
      `מפרסם: ${publisher.fullName || '-'} (${waId})`,
      '———',
      snippet,
      '———',
      `החלטה: ${verdict}`,
      ...(detail ? [`סיבה: ${detail}`] : []),
    ].join('\n')
    await notifyLog(msg, decisionLogChatId)
  }

  // 5. Is this an event? (relaxed; accepts partial detail.) A transient AI/transport
  // error RELEASES the claim, so the same message can be re-evaluated on re-post.
  const detection = await detectEventFromFreeText(rawText, { openaiApiKey, openaiModel, correlationId })
  if (detection?.transient) { await releaseClaim(); return skip(`detect_error:${detection.reason || 'n/a'}`) }
  if (!detection?.isEvent) { await logDecision('❌ לא זוהה כאירוע', detection?.reason || ''); return skip(`not_event:${detection?.reason || 'n/a'}`) }

  // 6. Extract structured event. Transient errors release the claim; a deterministic
  // failure is a final verdict, so the claim stays to avoid reprocessing.
  const { formattedEvent, errorReason, transient } = await extractEventFromFreeText(rawText, getCategoriesList(), CITIES_LIST, { openaiApiKey, openaiModel })
  if (transient) { await releaseClaim(); return skip(`extract_error:${errorReason || 'n/a'}`) }
  if (errorReason || !formattedEvent) { await logDecision('⚠️ חילוץ נכשל', errorReason || ''); return skip(`extract_failed:${errorReason || 'n/a'}`) }

  // Abort if the event already happened: when the AI extracted occurrences and ALL of
  // them are in the past, there's nothing to publish. No occurrences at all → continue
  // (the publisher can fill in the date); any future occurrence → continue.
  const today = getTodayIsrael()
  const occurrenceDates = ((formattedEvent.occurrences || []) as Array<{ date?: string }>)
    .map((o) => o.date)
    .filter(Boolean) as string[]
  if (occurrenceDates.length && occurrenceDates.every((dt) => dt < today)) {
    await logDecision('🕒 אירוע שכבר עבר')
    return skip('event_in_past')
  }

  // 7. Skip if it matches an existing FUTURE event the AI judges to be the SAME real-world
  // happening — compared in a SINGLE AI call over candidates from two sources:
  //   A) the sender's OWN account (any future date) — "did I already post this?"
  //   B) ANY account, but only events in the SAME city with a matching future occurrence date —
  //      catches the same event posted by a DIFFERENT publisher/account in the groups.
  // (B) is a tight, sparse DB pre-filter, so it usually adds nothing and costs no extra tokens
  // (matchCrawlerEvent skips OpenAI when there are no candidates). The AI still makes the final
  // call — same city + same date alone is NOT treated as a duplicate.
  const eventsCol = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')
  const MATCH_PROJECTION = { 'event.Title': 1, 'event.shortDescription': 1, 'event.location.city': 1, 'event.occurrences': 1 }

  // Resolve the sender's account (tenant key) once — used both for the own-account dedup
  // candidates below and for stamping the draft (step 9). ensureAccountForPublisher is
  // idempotent and DB-free when the publisher already has an account.
  const accountId = await ensureAccountForPublisher({ _id: publisher._id, accountId: publisher.accountId, accountName: publisher.accountName, waId })
  const accountEvents = await eventsCol
    .find({ 'event.accountId': accountId, ...NOT_DELETED }, { projection: MATCH_PROJECTION })
    .toArray()

  const futureDates = occurrenceDates.filter((dt) => dt >= today)
  const extractedCity = String((formattedEvent.location as { city?: string } | undefined)?.city || '').trim()
  const crossAccountEvents = extractedCity && futureDates.length
    ? await eventsCol
        .find(
          { 'event.location.city': extractedCity, 'event.occurrences.date': { $in: futureDates }, ...NOT_DELETED },
          { projection: MATCH_PROJECTION },
        )
        .toArray()
    : []

  // Merge both sources, de-duplicated by event id.
  const candidateDocs = new Map<string, any>()
  for (const d of [...accountEvents, ...crossAccountEvents]) candidateDocs.set(d._id.toString(), d)

  // The matcher compares the new event's primary date against each candidate's date and treats
  // differing dates as different events — so pick the candidate occurrence that EQUALS the new
  // event's date when present (else its first future date), to avoid a false date conflict.
  const newPrimaryDate = String((formattedEvent.occurrences as Array<{ date?: string }> | undefined)?.[0]?.date || '')
  const candidates = [...candidateDocs.values()]
    .map((d: any) => {
      const futureOcc = (d.event?.occurrences || []).map((o: any) => o.date).filter((dt: string) => dt && dt >= today).sort()
      if (!futureOcc.length) return null
      const date = newPrimaryDate && futureOcc.includes(newPrimaryDate) ? newPrimaryDate : futureOcc[0]
      return { id: d._id.toString(), title: d.event?.Title || '', city: d.event?.location?.city || '', date, shortDescription: d.event?.shortDescription || '' }
    })
    .filter(Boolean)
    .slice(0, MAX_MATCH_CANDIDATES) as Array<{ id: string; title: string; city: string; date: string; shortDescription: string }>

  const match = await matchCrawlerEvent(formattedEvent, candidates, rawText, { openaiApiKey, openaiModel, correlationId })
  if (match.matchedId) {
    const sim = typeof match.similarity === 'number' ? ` (דמיון ${match.similarity}%)` : ''
    await logDecision('♻️ כפילות של אירוע קיים', `${match.reason || ''}${sim} — מזהה ${match.matchedId}`)
    return skip(`already_exists:${match.matchedId}`)
  }

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
  // `accountId` (the tenant key) was resolved above in step 7.
  const { eventObj, validDraft } = buildCrawlerDraftEvent(formattedEvent, publisherId, media, waId, accountId)
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

  await logDecision('✅ נוצרה טיוטה', `${String(eventObj.Title || '')} — מזהה ${draftId}`)

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

      // Only AFTER the publisher was notified, surface the new draft to the log group
      // (plain notice; best-effort — notifyLog never throws).
      const account = await resolveAccountTitle({ accountId: publisher.accountId, accountName: publisher.accountName, waId })
      const logMsg = buildApproverDraftNotification({
        title: String(eventObj.Title || ''),
        account,
        publisherName: String(publisher.fullName || ''),
        phone: waId,
        eventId: draftId,
        groupName,
      })
      await notifyLog(logMsg)
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


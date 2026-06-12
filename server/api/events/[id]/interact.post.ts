import { getMongoConnection } from '~/server/utils/mongodb'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { ObjectId } from 'mongodb'

const VALID_ACTIONS = new Set(['view', 'share', 'nav', 'calendar', 'link', 'contact'])
const OCCURRENCE_ACTIONS = new Set(['view', 'calendar']) // tied to a specific date

// Dev-only diagnostic logging — `import.meta.dev` is statically false in the prod build,
// so these calls are stripped from the production bundle entirely.
const DEV_LOG = '[Interact][DEV]'
function devLog(message: string, data?: unknown) {
  if (import.meta.dev) console.info(DEV_LOG, message, data !== undefined ? JSON.stringify(data) : '')
}

export default defineEventHandler(async (event) => {
  await checkRateLimit(event)

  const rawId = getRouterParam(event, 'id')
  if (!rawId) throw createError({ statusCode: 400, message: 'id required' })

  // The frontend flattens events into per-occurrence cards with composite ids of the form
  // `<eventObjectId>-<occurrenceIndex>` (see flattenEventsByOccurrence in utils/events.service.js).
  // Normalize back to the bare 24-char ObjectId — `new ObjectId('…-0')` throws, and the dashboard
  // keys stats off events._id (no suffix), so stats must be stored under the bare id to be counted.
  const id = rawId.split('-')[0]

  const body = await readBody<{
    action?: string
    visitorId?: string
    occurrenceDate?: string
    navType?: string
    calendarType?: string
    linkTitle?: string
    linkType?: string
  }>(event)

  const action = typeof body?.action === 'string' ? body.action : ''
  const visitorId = typeof body?.visitorId === 'string' ? body.visitorId.slice(0, 64) : ''
  const occurrenceDate = typeof body?.occurrenceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.occurrenceDate)
    ? body.occurrenceDate
    : null

  devLog('request received', { rawId, normalizedId: id, action, occurrenceDate, visitorId: visitorId.slice(0, 12), rawBody: body })

  if (!VALID_ACTIONS.has(action) || !visitorId) {
    devLog('REJECTED 400 invalid_input', { action, hasVisitorId: !!visitorId })
    throw createError({ statusCode: 400, message: 'invalid_input' })
  }

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()

  // Resolve publisherId from the event document; refuse interactions for missing/soft-deleted events
  // so stale open tabs can't create stats data after deletion
  const eventsCol = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')
  let publisherId = ''
  try {
    const doc = await eventsCol.findOne(
      { _id: new ObjectId(id) },
      { projection: { 'event.publisherId': 1, deletedAt: 1 } },
    )
    if (!doc || doc.deletedAt) {
      devLog('SKIP — event missing or soft-deleted, no stats written', { id, found: !!doc, deletedAt: doc?.deletedAt })
      return { success: false }
    }
    publisherId = doc?.event?.publisherId || ''
    devLog('event resolved', { id, publisherId: publisherId || '(empty)' })
  } catch (err) {
    devLog('SKIP — invalid ObjectId or lookup error', { id, error: err instanceof Error ? err.message : String(err) })
    return { success: false }
  }

  const interactionsCol = db.collection(config.mongodbCollectionEventInteractions || 'eventInteractions')
  const statsCol = db.collection(config.mongodbCollectionEventStats || 'eventStats')
  const occStatsCol = db.collection(config.mongodbCollectionEventOccurrenceStats || 'eventOccurrenceStats')

  const now = new Date()

  // Build interaction document
  const interaction: Record<string, unknown> = {
    eventId: id,
    publisherId,
    action,
    visitorId,
    timestamp: now,
    ...(occurrenceDate ? { occurrenceDate } : {}),
  }
  if (body.navType) interaction.navType = String(body.navType).slice(0, 20)
  if (body.calendarType) interaction.calendarType = String(body.calendarType).slice(0, 20)
  if (body.linkTitle) interaction.linkTitle = String(body.linkTitle).slice(0, 100)
  if (body.linkType) interaction.linkType = String(body.linkType).slice(0, 10)

  // Indexes are ensured once at startup by server/plugins/ensure-indexes.ts

  await interactionsCol.insertOne(interaction)

  if (OCCURRENCE_ACTIONS.has(action) && occurrenceDate) {
    // Occurrence-level stats (view, calendar)
    const inc: Record<string, number> = {}

    if (action === 'view') {
      inc.views = 1
      const alreadySeen = await interactionsCol.countDocuments(
        { eventId: id, occurrenceDate, action: 'view', visitorId },
        { limit: 2 },
      )
      if (alreadySeen <= 1) inc.uniqueViews = 1
    } else if (action === 'calendar') {
      inc.calendarAdds = 1
    }

    // No $setOnInsert for the counters — $inc creates a missing field at the increment
    // value, and listing the same path in both $inc and $setOnInsert is a Mongo conflict.
    const r = await occStatsCol.updateOne(
      { eventId: id, occurrenceDate },
      {
        $inc: inc,
        $set: { publisherId, lastInteractionAt: now },
      },
      { upsert: true },
    )
    devLog('eventOccurrenceStats write OK', { eventId: id, occurrenceDate, inc, matched: r.matchedCount, modified: r.modifiedCount, upsertedId: r.upsertedId })
  } else {
    // Event-level stats (share, nav, link, contact)
    const inc: Record<string, number> = {}
    if (action === 'share') inc.shares = 1
    else if (action === 'nav') inc.navClicks = 1
    else if (action === 'link') inc.linkClicks = 1
    else if (action === 'contact') inc.contactClicks = 1
    else if (action === 'view') inc.views = 1 // fallback: view without occurrenceDate

    const r = await statsCol.updateOne(
      { eventId: id },
      {
        $inc: inc,
        $set: { publisherId, lastInteractionAt: now },
      },
      { upsert: true },
    )
    devLog('eventStats write OK', { eventId: id, inc, matched: r.matchedCount, modified: r.modifiedCount, upsertedId: r.upsertedId })
  }

  return { success: true }
})

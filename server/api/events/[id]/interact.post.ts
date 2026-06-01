import { getMongoConnection } from '~/server/utils/mongodb'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { ObjectId } from 'mongodb'

const VALID_ACTIONS = new Set(['view', 'share', 'nav', 'calendar', 'link', 'contact'])
const OCCURRENCE_ACTIONS = new Set(['view', 'calendar']) // tied to a specific date

export default defineEventHandler(async (event) => {
  await checkRateLimit(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id required' })

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

  if (!VALID_ACTIONS.has(action) || !visitorId) {
    throw createError({ statusCode: 400, message: 'invalid_input' })
  }

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()

  // Resolve publisherId from the event document
  const eventsCol = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')
  let publisherId = ''
  try {
    const doc = await eventsCol.findOne({ _id: new ObjectId(id) }, { projection: { 'event.publisherId': 1 } })
    publisherId = doc?.event?.publisherId || ''
  } catch {}

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

  // Ensure indexes
  interactionsCol.createIndex({ eventId: 1, action: 1, timestamp: -1 }).catch(() => {})
  interactionsCol.createIndex({ eventId: 1, action: 1, visitorId: 1 }).catch(() => {})
  interactionsCol.createIndex({ publisherId: 1, timestamp: -1 }).catch(() => {})
  statsCol.createIndex({ eventId: 1 }, { unique: true }).catch(() => {})
  statsCol.createIndex({ publisherId: 1 }).catch(() => {})
  occStatsCol.createIndex({ eventId: 1, occurrenceDate: 1 }, { unique: true }).catch(() => {})
  occStatsCol.createIndex({ publisherId: 1, occurrenceDate: 1 }).catch(() => {})

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

    await occStatsCol.updateOne(
      { eventId: id, occurrenceDate },
      {
        $inc: inc,
        $set: { publisherId, lastInteractionAt: now },
        $setOnInsert: { views: 0, uniqueViews: 0, calendarAdds: 0 },
      },
      { upsert: true },
    )
  } else {
    // Event-level stats (share, nav, link, contact)
    const inc: Record<string, number> = {}
    if (action === 'share') inc.shares = 1
    else if (action === 'nav') inc.navClicks = 1
    else if (action === 'link') inc.linkClicks = 1
    else if (action === 'contact') inc.contactClicks = 1
    else if (action === 'view') inc.views = 1 // fallback: view without occurrenceDate

    await statsCol.updateOne(
      { eventId: id },
      {
        $inc: inc,
        $set: { publisherId, lastInteractionAt: now },
        $setOnInsert: { shares: 0, navClicks: 0, linkClicks: 0, contactClicks: 0 },
      },
      { upsert: true },
    )
  }

  return { success: true }
})

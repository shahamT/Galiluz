import { randomBytes } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { getCategoriesList } from '~/server/consts/events.const'
import { validatePublisherFormattedEvent, normalizePublisherFormattedEvent } from '~/server/utils/eventValidation'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'
import { logEventCreation } from '~/server/utils/eventLogs.service'

const LOG_PREFIX = '[EventsAPI] Process'

/** Accept formattedEvent from wa-bot (format runs in wa-bot). Validate and update draft. */
export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'id required' })
  }

  const body = await readBody<{ formattedEvent?: unknown }>(event)
  const formattedEventRaw = body?.formattedEvent
  if (!formattedEventRaw || typeof formattedEventRaw !== 'object') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'formattedEvent is required',
    })
  }

  let objectId: ObjectId
  try {
    objectId = new ObjectId(id)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid id' })
  }

  const correlationId = randomBytes(4).toString('hex')
  const config = useRuntimeConfig()
  const mongoUri = config.mongodbUri || process.env.MONGODB_URI
  const mongoDbName = config.mongodbDbName || process.env.MONGODB_DB_NAME
  const eventsCollectionName =
    config.mongodbCollectionEventsWaBot ||
    config.mongodbCollectionEvents ||
    process.env.MONGODB_COLLECTION_EVENTS ||
    'events'

  if (!mongoUri || !mongoDbName) {
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
  }

  const { db } = await getMongoConnection()
  const collection = db.collection(eventsCollectionName)
  const doc = await collection.findOne({ _id: objectId })
  if (!doc) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'draft not found' })
  }
  if (doc.event != null) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'draft already processed' })
  }

  const validCategoryIds = getCategoriesList().map((c) => c.id)
  const formattedEvent = { ...formattedEventRaw } as Record<string, unknown>
  normalizePublisherFormattedEvent(formattedEvent, validCategoryIds)
  const publisherId = doc.rawEvent?.publisherId ?? doc.rawEvent?.publisher?.publisherId
  if (publisherId && typeof publisherId === 'string') {
    formattedEvent.publisherId = publisherId
  }
  const validation = validatePublisherFormattedEvent(formattedEvent)
  if (!validation.valid) {
    console.warn(LOG_PREFIX, correlationId, 'validation failed', JSON.stringify({ id, reason: validation.reason }))
    throw createError({
      statusCode: 422,
      statusMessage: 'Unprocessable Entity',
      message: validation.reason,
    })
  }

  const updateResult = await collection.updateOne(
    { _id: objectId },
    { $set: { event: formattedEvent, updatedAt: new Date() } }
  )
  if (updateResult.matchedCount === 0) {
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
  }
  console.info(LOG_PREFIX, correlationId, 'draft updated', JSON.stringify({ id }))
  const rawEvent = doc.rawEvent as Record<string, unknown> | undefined
  const publisherIdStr = rawEvent?.publisherId ?? (rawEvent?.publisher as Record<string, unknown>)?.publisherId
  const waIdStr = (rawEvent?.publisher as Record<string, unknown>)?.waId
  await logEventCreation({
    eventId: id,
    action: 'draft_processed',
    title: typeof formattedEvent.Title === 'string' ? formattedEvent.Title : undefined,
    publisherId: typeof publisherIdStr === 'string' ? publisherIdStr : undefined,
    waId: typeof waIdStr === 'string' ? waIdStr : undefined,
    correlationId,
  })
  return { formattedEvent, success: true }
})

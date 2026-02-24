import { randomBytes } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { getCategoriesList } from '~/server/consts/events.const'
import { formatPublisherEvent } from '~/server/services/eventFormatOpenAI'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'

const LOG_PREFIX = '[EventsAPI] Process'

/** Load draft by id, run format on rawEvent, update doc with event. Returns formattedEvent or 422. */
export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'id required' })
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

  const rawEventWithAll = doc.rawEvent as Record<string, unknown>
  if (!rawEventWithAll || typeof rawEventWithAll !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'draft missing rawEvent' })
  }

  const rawTitle = typeof rawEventWithAll.rawTitle === 'string' ? rawEventWithAll.rawTitle.trim() : ''
  const rawOccurrences = typeof rawEventWithAll.rawOccurrences === 'string' ? rawEventWithAll.rawOccurrences.trim() : ''
  const payloadSummary = {
    id,
    rawTitleLength: rawTitle.length,
    rawOccurrencesLength: rawOccurrences.length,
    rawMainCategory: rawEventWithAll.rawMainCategory ?? '(empty)',
    rawMediaCount: Array.isArray(rawEventWithAll.rawMedia) ? (rawEventWithAll.rawMedia as unknown[]).length : 0,
  }
  console.info(LOG_PREFIX, correlationId, 'payload', JSON.stringify(payloadSummary))

  if (!rawTitle) {
    console.warn(LOG_PREFIX, correlationId, 'abort: rawTitle is empty', JSON.stringify({ id }))
    throw createError({
      statusCode: 422,
      statusMessage: 'Unprocessable Entity',
      message: 'rawTitle is required for format',
    })
  }
  if (!rawOccurrences) {
    console.warn(LOG_PREFIX, correlationId, 'abort: rawOccurrences (date/time) is empty', JSON.stringify({ id }))
    throw createError({
      statusCode: 422,
      statusMessage: 'Unprocessable Entity',
      message: 'rawOccurrences (date/time) is required for format',
    })
  }

  let formattedEvent: Record<string, unknown> | null = null
  let errorMessage: string | undefined
  try {
    const categoriesList = getCategoriesList()
    console.info(LOG_PREFIX, correlationId, 'format start', JSON.stringify({ id }))
    const result = await formatPublisherEvent(rawEventWithAll, categoriesList, { correlationId })
    if (result.formattedEvent) {
      formattedEvent = result.formattedEvent as unknown as Record<string, unknown>
      const ev = result.formattedEvent
      const occCount = Array.isArray(ev.occurrences) ? ev.occurrences.length : 0
      console.info(LOG_PREFIX, correlationId, 'format success', JSON.stringify({
        id,
        occurrencesCount: occCount,
        city: ev.location?.City ?? '',
      }))
    } else {
      errorMessage = result.errorReason ?? 'format returned null'
      console.warn(LOG_PREFIX, correlationId, 'format failed', JSON.stringify({ id, reason: errorMessage, ...payloadSummary }))
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errorMessage = msg
    console.error(LOG_PREFIX, correlationId, 'format error', JSON.stringify({ id, error: msg }))
  }

  if (formattedEvent === null) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Unprocessable Entity',
      message: errorMessage ?? 'Event format failed',
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
  return { formattedEvent, success: true }
})

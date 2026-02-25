import { randomBytes } from 'node:crypto'
import { getCategoriesList } from '~/server/consts/events.const'
import { validatePublisherFormattedEvent, normalizePublisherFormattedEvent } from '~/server/utils/eventValidation'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'

const LOG_PREFIX = '[EventsAPI] Create'

interface PublisherInfo {
  phone?: string
  name?: string
  waId: string
}

/** Request body: formattedEvent (required), rawEvent, media, mainCategory, categories for stored rawEvent. */
interface CreateBody {
  formattedEvent: Record<string, unknown>
  rawEvent?: Record<string, unknown> & { publisher?: PublisherInfo }
  media?: Array<{ cloudinaryURL: string; cloudinaryData: Record<string, unknown>; isMain?: boolean }>
  mainCategory?: string
  categories?: string[]
}

/** Insert event. formattedEvent is required (wa-bot formats locally). */
export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const correlationId = randomBytes(4).toString('hex')
  const body = await readBody<CreateBody>(event)

  const formattedEventSupplied = body?.formattedEvent && typeof body.formattedEvent === 'object' ? body.formattedEvent as Record<string, unknown> : null
  if (!formattedEventSupplied) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'formattedEvent is required',
    })
  }

  const rawEvent = body?.rawEvent && typeof body.rawEvent === 'object' ? body.rawEvent : {}
  const media = Array.isArray(body?.media) ? body.media : []
  const mainCategory = typeof body?.mainCategory === 'string' ? body.mainCategory.trim() : ''
  const categories = Array.isArray(body?.categories) ? body.categories.filter((c) => typeof c === 'string') : []

  const config = useRuntimeConfig()
  const mongoUri = config.mongodbUri || process.env.MONGODB_URI
  const mongoDbName = config.mongodbDbName || process.env.MONGODB_DB_NAME
  const mainEventsCollection =
    config.mongodbCollectionEvents || process.env.MONGODB_COLLECTION_EVENTS || 'events'
  const eventsCollectionName =
    config.mongodbCollectionEventsWaBot || mainEventsCollection
  const publishersCollectionName =
    config.mongodbCollectionPublishers ||
    process.env.MONGODB_COLLECTION_PUBLISHERS ||
    'publishers'

  if (!mongoUri || !mongoDbName) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
    })
  }

  let publisherId: string | null = null
  const publisher = rawEvent.publisher as PublisherInfo | undefined
  const waId = publisher?.waId && typeof publisher.waId === 'string' ? publisher.waId : ''

  if (waId) {
    try {
      const { db } = await getMongoConnection()
      const publishersCol = db.collection(publishersCollectionName)
      const pubDoc = await publishersCol.findOne({ waId })
      if (pubDoc && pubDoc._id) {
        publisherId = pubDoc._id.toString()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(LOG_PREFIX, correlationId, 'publisher lookup error', JSON.stringify({ error: msg, waId }))
    }
  }

  const publisherWithId = {
    ...(typeof rawEvent.publisher === 'object' && rawEvent.publisher ? rawEvent.publisher : {}),
    publisherId: publisherId ?? undefined,
  }

  const rawEventWithAll = {
    ...rawEvent,
    publisher: publisherWithId,
    publisherId: publisherId ?? undefined,
    rawMainCategory: mainCategory,
    rawCategories: categories,
    rawMedia: media,
  }

  const validCategoryIds = getCategoriesList().map((c) => c.id)
  const formattedEvent = { ...formattedEventSupplied }
  normalizePublisherFormattedEvent(formattedEvent, validCategoryIds)
  if (publisherId) {
    formattedEvent.publisherId = publisherId
  }
  const validation = validatePublisherFormattedEvent(formattedEvent)
  if (!validation.valid) {
    console.warn(LOG_PREFIX, correlationId, 'validation failed', JSON.stringify({ reason: validation.reason }))
    throw createError({
      statusCode: 422,
      statusMessage: 'Unprocessable Entity',
      message: validation.reason,
    })
  }

  try {
    const { db } = await getMongoConnection()
    const collection = db.collection(eventsCollectionName)
    const doc = {
      createdAt: new Date(),
      isActive: false,
      event: formattedEvent,
      rawEvent: rawEventWithAll,
    }
    const result = await collection.insertOne(doc)
    const id = result.insertedId.toString()
    console.info(LOG_PREFIX, correlationId, 'inserted', JSON.stringify({ id }))
    return { id, success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(LOG_PREFIX, correlationId, 'insert error', JSON.stringify({ error: msg }))
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    })
  }
})

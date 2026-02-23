import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'

interface PublisherInfo {
  phone?: string
  name?: string
  waId: string
}

interface CreateBody {
  rawEvent: Record<string, unknown> & { publisher?: PublisherInfo }
  media: Array<{ cloudinaryURL: string; cloudinaryData: Record<string, unknown>; isMain?: boolean }>
  mainCategory: string
  categories: string[]
}

export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const body = await readBody<CreateBody>(event)

  const rawEvent = body?.rawEvent
  const media = Array.isArray(body?.media) ? body.media : []
  const mainCategory = typeof body?.mainCategory === 'string' ? body.mainCategory.trim() : ''
  const categories = Array.isArray(body?.categories) ? body.categories.filter((c) => typeof c === 'string') : []

  if (!rawEvent || typeof rawEvent !== 'object') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'rawEvent is required',
    })
  }

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
      console.error('[EventsAPI] Create: publisher lookup error', err instanceof Error ? err.message : String(err))
    }
  }

  const rawEventWithPublisher = {
    ...rawEvent,
    publisher: {
      ...(typeof rawEvent.publisher === 'object' && rawEvent.publisher ? rawEvent.publisher : {}),
      publisherId: publisherId ?? undefined,
    },
  }

  try {
    const { db } = await getMongoConnection()
    const collection = db.collection(eventsCollectionName)
    const doc = {
      createdAt: new Date(),
      rawEvent: rawEventWithPublisher,
      media,
      mainCategory,
      categories,
      isActive: false,
      event: null,
    }
    const result = await collection.insertOne(doc)
    const id = result.insertedId.toString()
    return { id, success: true }
  } catch (err) {
    console.error('[EventsAPI] Create error:', err instanceof Error ? err.message : String(err))
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    })
  }
})

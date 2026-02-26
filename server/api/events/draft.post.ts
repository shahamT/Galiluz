import { randomBytes } from 'node:crypto'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'
import { logEventCreation } from '~/server/utils/eventLogs.service'

const LOG_PREFIX = '[EventsAPI] Draft'

interface PublisherInfo {
  phone?: string
  name?: string
  waId: string
}

/** Same body as create: rawEvent, media, mainCategory, categories. Inserts a draft (raw only, event: null). */
interface DraftBody {
  rawEvent: Record<string, unknown> & { publisher?: PublisherInfo }
  media: Array<{ cloudinaryURL: string; cloudinaryData: Record<string, unknown>; isMain?: boolean }>
  mainCategory: string
  categories: string[]
}

/** Create a draft record with raw data only. No format step. Used so the record exists in MongoDB before processing. */
export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const correlationId = randomBytes(4).toString('hex')
  const body = await readBody<DraftBody>(event)

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
  const eventsCollectionName =
    config.mongodbCollectionEventsWaBot ||
    config.mongodbCollectionEvents ||
    process.env.MONGODB_COLLECTION_EVENTS ||
    'events'
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

  console.info(LOG_PREFIX, correlationId, 'insert draft', JSON.stringify({
    rawTitleLength: typeof rawEventWithAll.rawTitle === 'string' ? rawEventWithAll.rawTitle.trim().length : 0,
    rawMediaCount: media.length,
  }))

  try {
    const { db } = await getMongoConnection()
    const collection = db.collection(eventsCollectionName)
    const doc = {
      createdAt: new Date(),
      isActive: false,
      event: null,
      rawEvent: rawEventWithAll,
    }
    const result = await collection.insertOne(doc)
    const id = result.insertedId.toString()
    console.info(LOG_PREFIX, correlationId, 'draft created', JSON.stringify({ id }))
    await logEventCreation({
      eventId: id,
      action: 'draft_created',
      rawTitle: typeof rawEventWithAll.rawTitle === 'string' ? rawEventWithAll.rawTitle : undefined,
      publisherId: publisherId ?? undefined,
      waId: waId || undefined,
      correlationId,
    })
    return { id, success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(LOG_PREFIX, correlationId, 'draft insert error', JSON.stringify({ error: msg }))
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    })
  }
})

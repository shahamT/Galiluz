import { randomBytes } from 'node:crypto'
import { getCategoriesList } from '~/server/consts/events.const'
import { formatPublisherEvent } from '~/server/services/eventFormatOpenAI'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'

const LOG_PREFIX = '[EventsAPI] Create'

interface PublisherInfo {
  phone?: string
  name?: string
  waId: string
}

/** Request body from wa-bot: rawEvent (raw* keys), media, mainCategory, categories. Optional formattedEvent: when provided (after user confirmed preview), skip format and insert it. */
interface CreateBody {
  rawEvent: Record<string, unknown> & { publisher?: PublisherInfo }
  media: Array<{ cloudinaryURL: string; cloudinaryData: Record<string, unknown>; isMain?: boolean }>
  mainCategory: string
  categories: string[]
  /** Pre-formatted event from /api/events/format (user confirmed); when valid, format step is skipped. */
  formattedEvent?: Record<string, unknown>
}

/** Creates an event from wa-bot payload: validate body, enrich rawEvent, format via OpenAI, insert doc (event + rawEvent). */
export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const correlationId = randomBytes(4).toString('hex')
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

  const inputSummary = {
    rawTitleLength: typeof rawEventWithAll.rawTitle === 'string' ? rawEventWithAll.rawTitle.trim().length : 0,
    hasRawOccurrences: Boolean(rawEventWithAll.rawOccurrences && String(rawEventWithAll.rawOccurrences).trim()),
    rawMainCategory: rawEventWithAll.rawMainCategory || '(empty)',
    rawCategoriesCount: Array.isArray(rawEventWithAll.rawCategories) ? rawEventWithAll.rawCategories.length : 0,
    rawMediaCount: Array.isArray(rawEventWithAll.rawMedia) ? rawEventWithAll.rawMedia.length : 0,
    hasFormattedEvent: Boolean(body?.formattedEvent && typeof body.formattedEvent === 'object'),
  }
  console.info(LOG_PREFIX, correlationId, 'start', JSON.stringify(inputSummary))

  let formattedEvent: Record<string, unknown> | null = null
  const suppliedFormatted = body?.formattedEvent && typeof body.formattedEvent === 'object' ? body.formattedEvent as Record<string, unknown> : null
  const isValidSuppliedEvent =
    suppliedFormatted &&
    typeof suppliedFormatted.Title === 'string' &&
    suppliedFormatted.location &&
    typeof suppliedFormatted.location === 'object' &&
    Array.isArray(suppliedFormatted.occurrences) &&
    suppliedFormatted.occurrences.length > 0

  if (isValidSuppliedEvent) {
    formattedEvent = suppliedFormatted
    console.info(LOG_PREFIX, correlationId, 'using supplied formattedEvent (user confirmed)')
  } else {
    try {
      const categoriesList = getCategoriesList()
      console.info(LOG_PREFIX, correlationId, 'format start')
      const formattedResult = await formatPublisherEvent(rawEventWithAll, categoriesList, { correlationId })
      if (formattedResult) {
        formattedEvent = formattedResult as unknown as Record<string, unknown>
        const occCount = Array.isArray(formattedResult.occurrences) ? formattedResult.occurrences.length : 0
        console.info(LOG_PREFIX, correlationId, 'format success', JSON.stringify({
          occurrencesCount: occCount,
          city: formattedResult.location?.City ?? '',
          mainCategory: formattedResult.mainCategory ?? '',
        }))
      } else {
        console.warn(LOG_PREFIX, correlationId, 'format returned null — see Publisher format logs above for reason')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(LOG_PREFIX, correlationId, 'format error', JSON.stringify({ error: msg }))
    }
  }

  if (formattedEvent === null) {
    console.warn(LOG_PREFIX, correlationId, 'abort: no formatted event (format failed or missing)')
    throw createError({
      statusCode: 422,
      statusMessage: 'Unprocessable Entity',
      message: 'Event format failed or missing; cannot create',
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

import { randomBytes } from 'node:crypto'
import { getCategoriesList } from '~/server/consts/events.const'
import { formatPublisherEvent } from '~/server/services/eventFormatOpenAI'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'

const LOG_PREFIX = '[EventsAPI] Format'

interface PublisherInfo {
  phone?: string
  name?: string
  waId: string
}

/** Same body as create: rawEvent (raw* keys), media, mainCategory, categories. Returns formatted event only; no DB insert. */
interface FormatBody {
  rawEvent: Record<string, unknown> & { publisher?: PublisherInfo }
  media: Array<{ cloudinaryURL: string; cloudinaryData: Record<string, unknown>; isMain?: boolean }>
  mainCategory: string
  categories: string[]
}

/** Format-only: build rawEventWithAll, call formatPublisherEvent, return { formattedEvent } or { formattedEvent: null, error: true }. */
export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const correlationId = randomBytes(4).toString('hex')
  const body = await readBody<FormatBody>(event)

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
  const publishersCollectionName =
    config.mongodbCollectionPublishers ||
    process.env.MONGODB_COLLECTION_PUBLISHERS ||
    'publishers'

  let publisherId: string | null = null
  const publisher = rawEvent.publisher as PublisherInfo | undefined
  const waId = publisher?.waId && typeof publisher.waId === 'string' ? publisher.waId : ''

  if (waId && mongoUri && mongoDbName) {
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

  let formattedEvent: Record<string, unknown> | null = null
  let errorMessage: string | undefined
  try {
    const categoriesList = getCategoriesList()
    const formattedResult = await formatPublisherEvent(rawEventWithAll, categoriesList, { correlationId })
    if (formattedResult.formattedEvent) {
      formattedEvent = formattedResult.formattedEvent as unknown as Record<string, unknown>
      const ev = formattedResult.formattedEvent
      console.info(LOG_PREFIX, correlationId, 'format success', JSON.stringify({
        occurrencesCount: Array.isArray(ev.occurrences) ? ev.occurrences.length : 0,
      }))
    } else {
      errorMessage = formattedResult.errorReason ?? 'format returned null'
      console.warn(LOG_PREFIX, correlationId, 'format failed', JSON.stringify({ reason: errorMessage }))
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errorMessage = msg
    console.error(LOG_PREFIX, correlationId, 'format error', JSON.stringify({ error: msg }))
  }

  if (formattedEvent) {
    return { formattedEvent }
  }
  return { formattedEvent: null, error: true, ...(errorMessage && { errorMessage }) }
})

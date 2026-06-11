import { getMongoConnection } from '~/server/utils/mongodb'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { transformEventForFrontend } from '~/server/utils/eventsTransform'
import {
  parseDatesParam,
  parseCategoriesParam,
  buildEventsQuery,
} from '~/server/utils/eventsQuery'

const EVENTS_QUERY_LIMIT = 500

function getCutoffDate(): Date {
  const now = new Date()
  const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const cutoff = new Date(firstDayOfCurrentMonth)
  cutoff.setDate(cutoff.getDate() - 5)
  return cutoff
}

export default defineEventHandler(async (event) => {
  await checkRateLimit(event)
  const config = useRuntimeConfig()
  const mongoUri = config.mongodbUri || process.env.MONGODB_URI
  const mongoDbName = config.mongodbDbName || process.env.MONGODB_DB_NAME
  const collectionName =
    config.mongodbCollectionEvents || process.env.MONGODB_COLLECTION_EVENTS || 'events'

  if (!mongoUri || !mongoDbName) {
    console.error('[EventsAPI] MongoDB not configured')
    return []
  }

  const queryParams = getQuery(event)
  const dateStrings = parseDatesParam(queryParams.dates as string | undefined)
  const categoriesArray = parseCategoriesParam(queryParams.categories as string | undefined)
  const region = typeof queryParams.region === 'string' ? queryParams.region.trim() : ''

  // Optional rolling window bounds (YYYY-MM-DD). `from` overrides the default cutoff,
  // `to` bounds the feed so clients can request a window instead of everything.
  const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/
  const fromParam = typeof queryParams.from === 'string' && YYYY_MM_DD.test(queryParams.from) ? queryParams.from : ''
  const toParam = typeof queryParams.to === 'string' && YYYY_MM_DD.test(queryParams.to) ? queryParams.to : ''

  try {
    const { db } = await getMongoConnection()
    const collection = db.collection(collectionName)
    const cutoff = fromParam ? new Date(`${fromParam}T00:00:00.000Z`) : getCutoffDate()
    const until = toParam ? new Date(`${toParam}T23:59:59.999Z`) : undefined
    const query = buildEventsQuery(cutoff, dateStrings, categoriesArray, region || undefined, until)

    const documents = await collection
      .find(query, { projection: { rawEvent: 0 } })
      .limit(EVENTS_QUERY_LIMIT)
      .toArray()

    const transformedEvents = documents
      .map((doc) => {
        try {
          return transformEventForFrontend(doc)
        } catch (error) {
          console.error(
            '[EventsAPI] Error transforming document:',
            error instanceof Error ? error.message : String(error),
          )
          return null
        }
      })
      .filter((t): t is Record<string, unknown> => t !== null)

    // Short shared cache: absorbs traffic spikes while keeping the feed fresh
    setHeader(event, 'Cache-Control', 'public, max-age=60')

    return transformedEvents
  } catch (error) {
    console.error(
      '[EventsAPI] Error fetching events:',
      error instanceof Error ? error.message : String(error),
    )
    return []
  }
})

import { getMongoConnection, getDbConfig } from '~/server/utils/mongodb'
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
  const { uri, dbName, collections } = getDbConfig()

  if (!uri || !dbName) {
    console.error('[EventsAPI] MongoDB not configured')
    return []
  }

  const queryParams = getQuery(event)
  const dateStrings = parseDatesParam(queryParams.dates as string | undefined)
  const categoriesArray = parseCategoriesParam(queryParams.categories as string | undefined)

  try {
    const { db } = await getMongoConnection()
    const collection = db.collection(collections.events)
    const cutoff = getCutoffDate()
    const query = buildEventsQuery(cutoff, dateStrings, categoriesArray)

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

    return transformedEvents
  } catch (error) {
    console.error(
      '[EventsAPI] Error fetching events:',
      error instanceof Error ? error.message : String(error),
    )
    return []
  }
})

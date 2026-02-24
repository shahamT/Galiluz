import { randomBytes } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'

const LOG_PREFIX = '[EventsAPI] Activate'

/** Set isActive: true on an existing (processed) draft. Called when user confirms in wa-bot. */
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
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'event not found' })
  }
  if (doc.event == null) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'event not yet processed' })
  }

  const result = await collection.updateOne(
    { _id: objectId },
    { $set: { isActive: true, updatedAt: new Date() } }
  )
  if (result.matchedCount === 0) {
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
  }
  console.info(LOG_PREFIX, correlationId, 'activated', JSON.stringify({ id }))
  return { id, success: true }
})

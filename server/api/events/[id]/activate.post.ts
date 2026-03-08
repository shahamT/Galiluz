import { randomBytes } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { getMongoConnection, getDbConfig } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'
import { logEventCreation } from '~/server/utils/eventLogs.service'

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
  const { uri, dbName, collections } = getDbConfig()

  if (!uri || !dbName) {
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
  }

  const { db } = await getMongoConnection()
  const collection = db.collection(collections.eventsWaBot || collections.events)
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
  const rawEvent = doc.rawEvent as Record<string, unknown> | undefined
  const publisherIdStr = rawEvent?.publisherId ?? (rawEvent?.publisher as Record<string, unknown>)?.publisherId
  const waIdStr = (rawEvent?.publisher as Record<string, unknown>)?.waId
  await logEventCreation({
    eventId: id,
    action: 'event_activated',
    title: doc.event && typeof doc.event === 'object' && typeof (doc.event as Record<string, unknown>).Title === 'string'
      ? (doc.event as Record<string, unknown>).Title as string
      : undefined,
    publisherId: typeof publisherIdStr === 'string' ? publisherIdStr : undefined,
    waId: typeof waIdStr === 'string' ? waIdStr : undefined,
    correlationId,
  })
  return { id, success: true }
})

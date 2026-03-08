import { ObjectId } from 'mongodb'
import { getMongoConnection, getDbConfig } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'
import { transformEventForFrontend } from '~/server/utils/eventsTransform'

/**
 * GET /api/events/[id]?waId=...
 * Returns one event by id in frontend shape (for wa-bot update flow).
 * If waId query is provided, verifies doc.rawEvent.publisher.waId === waId so only owner can load.
 */
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

  const waId = getQuery(event).waId
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

  if (waId && typeof waId === 'string' && waId.trim()) {
    const rawEvent = doc.rawEvent as Record<string, unknown> | null | undefined
    const docWaId = (rawEvent?.publisher as Record<string, unknown>)?.waId
    if (docWaId !== waId.trim()) {
      throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'event not found' })
    }
  }

  const transformed = transformEventForFrontend(doc)
  if (!transformed) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'event not found' })
  }
  return transformed
})

import { randomBytes } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'
import { logEventDeletion } from '~/server/utils/eventLogs.service'
import { softDeleteEventStatsData } from '~/server/utils/eventStats.service'

const LOG_PREFIX = '[EventsAPI] Delete'

/** Body for delete: optional deletionType to record why the event was removed. */
interface DeleteBody {
  deletionType?: 'kill' | 'user_deleted'
}

/**
 * Delete an event document (draft or published). Logs the deletion to eventLogs then removes the document.
 * Body.deletionType: 'kill' = flow abandoned (e.g. timeout/cancel before completing add); 'user_deleted' = user chose to delete (default).
 * Requires API secret.
 */
export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'id required' })
  }

  const body = await readBody<DeleteBody>(event).catch(() => ({}))
  const deletionType = body?.deletionType === 'kill' ? 'kill' : 'user_deleted'

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

  // Already soft-deleted: idempotent success
  if (doc.deletedAt) {
    return { success: true, id }
  }

  const ev = doc.event as Record<string, unknown> | null | undefined
  const rawEv = doc.rawEvent as Record<string, unknown> | null | undefined
  const title = ev && typeof ev.Title === 'string' ? ev.Title : undefined
  const rawTitle = rawEv && typeof rawEv.rawTitle === 'string' ? rawEv.rawTitle : undefined
  const publisherIdStr = rawEv?.publisherId ?? (rawEv?.publisher as Record<string, unknown>)?.publisherId
  const waIdStr = (rawEv?.publisher as Record<string, unknown>)?.waId

  await logEventDeletion({
    eventId: id,
    deletionType,
    title,
    rawTitle,
    publisherId: typeof publisherIdStr === 'string' ? publisherIdStr : undefined,
    waId: typeof waIdStr === 'string' ? waIdStr : undefined,
    correlationId,
  })

  // Soft delete: the event doc first (interact guard checks it), then stamp its stats
  const deletedAt = new Date()
  const deleteResult = await collection.updateOne(
    { _id: objectId },
    { $set: { deletedAt, isActive: false } },
  )
  if (deleteResult.matchedCount === 0) {
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
  }

  await softDeleteEventStatsData(id, deletedAt)

  console.info(LOG_PREFIX, correlationId, 'soft-deleted', JSON.stringify({ id, deletionType }))
  return { success: true, id }
})

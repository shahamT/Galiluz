import { randomBytes } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { getMongoConnection, getDbConfig } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'
import { logEventDeletion } from '~/server/utils/eventLogs.service'

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

  const deleteResult = await collection.deleteOne({ _id: objectId })
  if (deleteResult.deletedCount === 0) {
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
  }
  console.info(LOG_PREFIX, correlationId, 'deleted', JSON.stringify({ id }))
  return { success: true, id }
})

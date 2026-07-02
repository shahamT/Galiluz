import { randomBytes } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'
import { logEventDeletion } from '~/server/utils/eventLogs.service'
import { softDeleteEventStatsData } from '~/server/utils/eventStats.service'
import { deleteEventCloudinaryMedia } from '~/server/utils/eventMedia.service'
import { resolveActorName } from '~/server/utils/approvers'
import { notifyPublisherWhatsApp, buildEventDeletedMessage } from '~/server/utils/notifyPublisher'

const LOG_PREFIX = '[EventsAPI] Delete'

/** Body: optional deletionType + the acting approver's waId (for first-wins conflict reporting) +
 *  optional reason — when given, the publisher is notified with it (via the gateway). */
interface DeleteBody {
  deletionType?: 'kill' | 'user_deleted'
  actorWaId?: string
  reason?: string
}

/**
 * Soft-delete an event. ATOMIC first-wins: only an as-yet-undeleted event is claimed (stamping the
 * actor), so concurrent approvers can't double-delete. Returns the event title + publisher phone so
 * the wa-bot can message the publisher and proactively notify the other approvers without relying on
 * its in-memory state. Loser → { applied:false, by } so the late approver is told who deleted it.
 */
export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'id required' })

  const body = await readBody<DeleteBody>(event).catch(() => ({} as DeleteBody))
  const deletionType = body?.deletionType === 'kill' ? 'kill' : 'user_deleted'
  const actorWaId = typeof body?.actorWaId === 'string' ? body.actorWaId.trim() : ''
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''

  let objectId: ObjectId
  try { objectId = new ObjectId(id) } catch { throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid id' }) }

  const correlationId = randomBytes(4).toString('hex')
  const config = useRuntimeConfig()
  const mongoUri = config.mongodbUri || process.env.MONGODB_URI
  const mongoDbName = config.mongodbDbName || process.env.MONGODB_DB_NAME
  const eventsCollectionName =
    config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || process.env.MONGODB_COLLECTION_EVENTS || 'events'
  if (!mongoUri || !mongoDbName) throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })

  const { db } = await getMongoConnection()
  const collection = db.collection(eventsCollectionName)
  const deletedAt = new Date()
  const actorName = actorWaId ? await resolveActorName(actorWaId) : 'מאשר'

  // Atomic first-wins claim: only an undeleted event transitions to deleted.
  const doc = await collection.findOneAndUpdate(
    { _id: objectId, deletedAt: { $exists: false } },
    { $set: { deletedAt, isActive: false, deletedByWaId: actorWaId || null, deletedByName: actorName } },
    { returnDocument: 'after' },
  )

  if (!doc) {
    // Loser (or unknown id): report who deleted it, if known.
    const current = await collection.findOne({ _id: objectId }, { projection: { deletedByName: 1, event: 1 } })
    if (!current) throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'event not found' })
    const ev = current.event as Record<string, unknown> | null | undefined
    return { applied: false, by: (current.deletedByName as string) || null, eventTitle: (ev && typeof ev.Title === 'string' ? ev.Title : '') }
  }

  // Winner: log, stamp stats, destroy media.
  const ev = doc.event as Record<string, unknown> | null | undefined
  const rawEv = doc.rawEvent as Record<string, unknown> | null | undefined
  const title = ev && typeof ev.Title === 'string' ? ev.Title : undefined
  const rawTitle = rawEv && typeof rawEv.rawTitle === 'string' ? rawEv.rawTitle : undefined
  const publisherIdStr = rawEv?.publisherId ?? (rawEv?.publisher as Record<string, unknown>)?.publisherId
  const waIdStr = (rawEv?.publisher as Record<string, unknown>)?.waId
  const publisherPhone =
    (ev && typeof ev.publisherPhone === 'string' && ev.publisherPhone) ||
    (typeof waIdStr === 'string' ? waIdStr : '') || ''

  await logEventDeletion({
    eventId: id,
    deletionType,
    title,
    rawTitle,
    publisherId: typeof publisherIdStr === 'string' ? publisherIdStr : undefined,
    waId: typeof waIdStr === 'string' ? waIdStr : undefined,
    correlationId,
  })
  await softDeleteEventStatsData(id, deletedAt)
  await deleteEventCloudinaryMedia(doc, correlationId)

  // Approver gave a reason → tell the publisher (gateway; the bot's Cloud API can't reach cold
  // users). Matches the old bot behavior: no reason, no publisher message.
  if (reason && publisherPhone && deletionType === 'user_deleted') {
    await notifyPublisherWhatsApp(publisherPhone, buildEventDeletedMessage(title || 'אירוע', reason))
  }

  console.info(LOG_PREFIX, correlationId, 'soft-deleted', JSON.stringify({ id, deletionType, by: actorName }))
  return { applied: true, id, eventTitle: title || '', publisherPhone, actorName }
})

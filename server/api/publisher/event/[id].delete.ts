import { randomBytes } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { ownsEventForSession } from '~/server/utils/accountScope'
import { logEventDeletion } from '~/server/utils/eventLogs.service'
import { softDeleteEventStatsData } from '~/server/utils/eventStats.service'
import { deleteEventCloudinaryMedia } from '~/server/utils/eventMedia.service'

export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id required' })

  let objectId: ObjectId
  try { objectId = new ObjectId(id) } catch {
    throw createError({ statusCode: 400, message: 'invalid id' })
  }

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const eventsCol = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')

  const doc = await eventsCol.findOne({ _id: objectId })
  if (!doc) throw createError({ statusCode: 404, message: 'event not found' })

  const ownsEvent = await ownsEventForSession(session, doc.event)
  if (!session.isSuperAdmin && !ownsEvent) {
    throw createError({ statusCode: 403, message: 'forbidden' })
  }

  // Already soft-deleted: idempotent success
  if (doc.deletedAt) return { success: true, id }

  const correlationId = randomBytes(4).toString('hex')
  const ev    = doc.event as Record<string, unknown> | null | undefined
  const rawEv = doc.rawEvent as Record<string, unknown> | null | undefined

  await logEventDeletion({
    eventId:     id,
    deletionType: 'user_deleted',
    title:       typeof ev?.Title === 'string' ? ev.Title : undefined,
    rawTitle:    typeof rawEv?.rawTitle === 'string' ? rawEv.rawTitle : undefined,
    publisherId: session.publisherId,
    waId:        session.waId,
    correlationId,
    isManagerAction: session.isSuperAdmin && !ownsEvent,
  })

  // Soft delete: the event doc first (interact guard checks it), then stamp its stats
  const deletedAt = new Date()
  const result = await eventsCol.updateOne(
    { _id: objectId },
    { $set: { deletedAt, isActive: false } },
  )
  if (result.matchedCount === 0) throw createError({ statusCode: 500 })

  await softDeleteEventStatsData(id, deletedAt)
  await deleteEventCloudinaryMedia(doc, correlationId)

  return { success: true, id }
})

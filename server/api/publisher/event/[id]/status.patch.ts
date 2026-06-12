import { randomBytes } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { logEventStatusChange } from '~/server/utils/eventLogs.service'

export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id required' })

  let objectId: ObjectId
  try { objectId = new ObjectId(id) } catch {
    throw createError({ statusCode: 400, message: 'invalid id' })
  }

  const body = await readBody<{ isActive?: unknown }>(event)
  if (!body || typeof body.isActive !== 'boolean') {
    throw createError({ statusCode: 400, message: 'isActive (boolean) required' })
  }

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const col = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')

  const doc = await col.findOne({ _id: objectId })
  if (!doc || doc.deletedAt) throw createError({ statusCode: 404, message: 'event not found' })

  if (session.type !== 'manager' && doc.event?.publisherId !== session.publisherId) {
    throw createError({ statusCode: 403, message: 'forbidden' })
  }

  await col.updateOne(
    { _id: objectId },
    { $set: { isActive: body.isActive, updatedAt: new Date() } },
  )

  if (doc.isActive !== body.isActive) {
    await logEventStatusChange({
      eventId: id,
      isActive: body.isActive,
      title: typeof doc.event?.Title === 'string' ? doc.event.Title : undefined,
      publisherId: session.publisherId,
      waId: session.waId,
      correlationId: randomBytes(4).toString('hex'),
      isManagerAction: session.type === 'manager' && doc.event?.publisherId !== session.publisherId,
    })
  }

  return { success: true, isActive: body.isActive }
})

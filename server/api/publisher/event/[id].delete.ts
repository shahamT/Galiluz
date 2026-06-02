import { randomBytes } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { logEventDeletion } from '~/server/utils/eventLogs.service'

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

  if (session.type !== 'manager' && doc.event?.publisherId !== session.publisherId) {
    throw createError({ statusCode: 403, message: 'forbidden' })
  }

  const correlationId = randomBytes(4).toString('hex')
  const ev    = doc.event as Record<string, unknown> | null | undefined
  const rawEv = doc.rawEvent as Record<string, unknown> | null | undefined

  await logEventDeletion({
    eventId:     id,
    deletionType: 'user_deleted',
    title:       typeof ev?.Title === 'string' ? ev.Title : undefined,
    rawTitle:    typeof rawEv?.rawTitle === 'string' ? rawEv.rawTitle : undefined,
    publisherId: session.publisherId,
    waId:        typeof (rawEv?.publisher as any)?.waId === 'string' ? (rawEv!.publisher as any).waId : undefined,
    correlationId,
  })

  const result = await eventsCol.deleteOne({ _id: objectId })
  if (result.deletedCount === 0) throw createError({ statusCode: 500 })

  return { success: true, id }
})

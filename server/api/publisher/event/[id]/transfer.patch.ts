import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { NOT_DELETED } from '~/server/utils/eventsQuery'
import { getEventLogsCollection } from '~/server/utils/eventLogs.service'
import { resolveExposedContactPhone } from '~/server/utils/contactPhone'

export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requireManager: true })
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id required' })

  let objectId: ObjectId
  try { objectId = new ObjectId(id) } catch {
    throw createError({ statusCode: 400, message: 'invalid id' })
  }

  const body = await readBody<{ targetPublisherId: string }>(event)
  const targetPublisherId = typeof body?.targetPublisherId === 'string' ? body.targetPublisherId.trim() : ''
  if (!targetPublisherId || !ObjectId.isValid(targetPublisherId))
    throw createError({ statusCode: 400, message: 'targetPublisherId required' })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const eventsCol     = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')
  const publishersCol = db.collection(config.mongodbCollectionPublishers || 'publishers')

  const doc = await eventsCol.findOne({ _id: objectId, ...NOT_DELETED })
  if (!doc) throw createError({ statusCode: 404, message: 'event not found' })

  const targetPub = await publishersCol.findOne({ _id: new ObjectId(targetPublisherId) })
  if (!targetPub) throw createError({ statusCode: 404, message: 'publisher not found' })

  const previousPublisherId = doc.event?.publisherId || ''
  const newWaId = (targetPub as any).waId || (targetPub as any).phone || ''

  // Update event.publisherId and mirror to rawEvent fields used by the wa-bot's by-publisher query.
  // Retroactively stamp originalCreatorPublisherId if not yet set (legacy events).
  const $setFields: Record<string, unknown> = {
    'event.publisherId': targetPublisherId,
    // Re-derive the public contact number for the NEW publisher, honoring the event's intent:
    // 'own' → new publisher's waId, custom → keep the custom number, hidden → stays hidden.
    'event.publisherPhone': resolveExposedContactPhone({
      showContactPhone: doc.event?.showContactPhone,
      customContactPhone: doc.event?.customContactPhone,
      ownWaId: newWaId,
    }),
    updatedAt: new Date(),
  }
  if (!doc.event?.originalCreatorPublisherId && previousPublisherId) {
    $setFields['event.originalCreatorPublisherId'] = previousPublisherId
  }
  if (doc.rawEvent?.publisherId !== undefined) {
    $setFields['rawEvent.publisherId'] = targetPublisherId
  }
  if (doc.rawEvent?.publisher && typeof doc.rawEvent.publisher === 'object') {
    $setFields['rawEvent.publisher.publisherId'] = targetPublisherId
    if (newWaId) $setFields['rawEvent.publisher.waId'] = newWaId
  }

  await eventsCol.updateOne({ _id: objectId }, { $set: $setFields })

  try {
    const logs = await getEventLogsCollection()
    await logs.insertOne({
      createdAt: new Date(),
      eventId: id,
      action: 'event_transferred',
      publisherId: targetPublisherId,
      previousPublisherId,
      waId: session.waId,
      actingManagerPublisherId: session.publisherId,
      isManagerAction: true,
    })
  } catch (err) {
    console.error('[transfer] log failed', err)
  }

  return { success: true }
})

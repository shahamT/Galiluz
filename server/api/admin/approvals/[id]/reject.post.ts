import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { rejectPublisher } from '~/server/utils/publisherApproval'

/**
 * Admin portal: reject a pending publisher (session, super_admin/owner — APPROVE_PUBLISHERS).
 * Reuses the shared atomic first-wins + cascade core (race-safe against a concurrent wa-bot rejecter).
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requireSuperAdmin: true })
  const id = getRouterParam(event, 'id')
  if (!id || !ObjectId.isValid(id)) throw createError({ statusCode: 400, message: 'invalid id' })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const pub = await db.collection(config.mongodbCollectionPublishers || 'publishers').findOne({ _id: new ObjectId(id) }, { projection: { waId: 1 } })
  if (!pub?.waId) throw createError({ statusCode: 404, message: 'publisher not found' })

  return rejectPublisher(db, config, pub.waId, { actorWaId: session.waId, actorName: session.fullName || 'מנהל' }, event)
})

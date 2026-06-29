import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { getAppSettingsCollection } from '~/server/utils/appSettings'

/**
 * Admin: add an approver (by publisherId) to the approvers list. Super-admin only.
 * The publisher must be approved and have a waId (approvers act + receive messages over WhatsApp).
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requirePlatformOwner: true })
  const body = await readBody<{ publisherId?: string }>(event)
  const publisherId = typeof body?.publisherId === 'string' ? body.publisherId.trim() : ''

  let objectId: ObjectId
  try { objectId = new ObjectId(publisherId) } catch { throw createError({ statusCode: 400, message: 'invalid publisherId' }) }

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const pub = await db
    .collection(config.mongodbCollectionPublishers || 'publishers')
    .findOne({ _id: objectId }, { projection: { status: 1, waId: 1, isActive: 1, deletedAt: 1 } })
  if (!pub || pub.status !== 'approved' || !pub.waId || pub.isActive === false || pub.deletedAt) {
    throw createError({ statusCode: 400, message: 'publisher must be approved, active and have a phone' })
  }

  const col = await getAppSettingsCollection()
  await col.updateOne(
    { key: 'approvers' },
    {
      $addToSet: { publisherIds: publisherId },
      $set: { updatedAt: new Date(), updatedBy: session.publisherId },
      $setOnInsert: { key: 'approvers', createdAt: new Date() },
    },
    { upsert: true },
  )
  return { success: true }
})

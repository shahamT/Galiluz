import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'

/**
 * GET /api/admin/broadcast/[id] (manager-only) — live status of a broadcast job, polled by
 * the admin page while sending. Manager scope is platform-wide (no publisher scoping).
 */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requirePlatformStaff: true })

  const id = getRouterParam(event, 'id') || ''
  if (!ObjectId.isValid(id)) throw createError({ statusCode: 400, message: 'invalid id' })

  const { db } = await getMongoConnection()
  const doc = await db.collection('broadcasts').findOne(
    { _id: new ObjectId(id) },
    { projection: { status: 1, sentCount: 1, failedIds: 1, recipientCount: 1, completedAt: 1 } },
  )
  if (!doc) throw createError({ statusCode: 404, message: 'broadcast not found' })

  const recipientCount = typeof doc.recipientCount === 'number' ? doc.recipientCount : 0
  return {
    status: doc.status || 'sending',
    sentCount: typeof doc.sentCount === 'number' ? doc.sentCount : 0,
    failedCount: Array.isArray(doc.failedIds) ? doc.failedIds.length : 0,
    recipientCount,
    total: recipientCount,
    completedAt: doc.completedAt || null,
  }
})

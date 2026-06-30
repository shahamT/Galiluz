import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { NOT_DELETED } from '~/server/utils/eventsQuery'

/**
 * Admin: rename a publisher (their `fullName` / display name). Mirrors the account title edit
 * ([account/[id].patch.ts]) — super_admin-only write (viewers are read-only). The canonical name
 * lives on the publisher doc; everything reads it fresh, so no denormalised copies to update.
 */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requireSuperAdmin: true })

  const id = getRouterParam(event, 'id')
  if (!id || !ObjectId.isValid(id)) throw createError({ statusCode: 400, message: 'invalid id' })

  const body = await readBody<{ fullName?: string }>(event)
  if (typeof body?.fullName !== 'string') throw createError({ statusCode: 400, message: 'fullName required' })
  const fullName = body.fullName.trim()
  if (!fullName) throw createError({ statusCode: 400, message: 'fullName required' })
  if (fullName.length > 80) throw createError({ statusCode: 400, message: 'fullName too long' })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const publishersCol = db.collection(config.mongodbCollectionPublishers || 'publishers')

  const res = await publishersCol.updateOne(
    { _id: new ObjectId(id), ...NOT_DELETED },
    { $set: { fullName, updatedAt: new Date() } },
  )
  if (!res.matchedCount) throw createError({ statusCode: 404, message: 'publisher not found' })
  return { success: true }
})

import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'

/**
 * Admin: deactivate / reactivate a publisher (super_admin/owner). Deactivation blocks login + kills any
 * live session (clears authKey) but keeps all data. Guards: can't deactivate yourself or the platform owner.
 * Body: { isActive: boolean }.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requireSuperAdmin: true })
  const id = getRouterParam(event, 'id')
  if (!id || !ObjectId.isValid(id)) throw createError({ statusCode: 400, message: 'invalid id' })

  const body = await readBody<{ isActive?: boolean }>(event)
  const isActive = body?.isActive === true

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const publishersCol = db.collection(config.mongodbCollectionPublishers || 'publishers')
  const membershipsCol = db.collection(config.mongodbCollectionMemberships || 'memberships')

  const pub = await publishersCol.findOne({ _id: new ObjectId(id) }, { projection: { _id: 1 } })
  if (!pub) throw createError({ statusCode: 404, message: 'publisher not found' })

  // Self-deactivate would lock you out.
  if (!isActive && id === session.publisherId) throw createError({ statusCode: 400, message: 'cannot_deactivate_self' })
  // A platform staffer's lifecycle is owner-only governance; the platform_owner is never deactivatable.
  const targetPlatformRole = (await membershipsCol.findOne(
    { publisherId: id, role: { $in: ['platform_owner', 'super_admin', 'viewer'] }, status: 'active' },
    { projection: { role: 1 } },
  ))?.role
  if (targetPlatformRole === 'platform_owner') throw createError({ statusCode: 400, message: 'cannot_deactivate_owner' })
  if (targetPlatformRole && !session.isPlatformOwner) throw createError({ statusCode: 403, message: 'platform_staff_owner_only' })

  const $set: Record<string, unknown> = { isActive, updatedAt: new Date() }
  const update: Record<string, unknown> = { $set }
  // Kill any live session on deactivate so it takes effect immediately.
  if (!isActive) update.$unset = { authKey: '', authKeyExpiresAt: '' }

  await publishersCol.updateOne({ _id: new ObjectId(id) }, update)
  console.info(`[admin/publisher] ${session.waId} set isActive=${isActive} for ${id}`)
  return { success: true, isActive }
})

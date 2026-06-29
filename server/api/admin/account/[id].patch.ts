import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { NOT_DELETED } from '~/server/utils/eventsQuery'
import { FEATURE_KEYS } from '~/consts/features.const.js'

/**
 * Admin: edit an account's details (title + feature entitlements). Gated by plane:
 *  - platform account → platform_owner only (governance).
 *  - business account → super_admin/owner (MANAGE_ACCOUNTS; viewer is read-only).
 * Feature flags apply to business accounts only (platform/super-admins bypass entitlements).
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requirePlatformStaff: true })

  const id = getRouterParam(event, 'id')
  if (!id || !ObjectId.isValid(id)) throw createError({ statusCode: 400, message: 'invalid id' })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const accountsCol = db.collection(config.mongodbCollectionAccounts || 'accounts')

  const account = await accountsCol.findOne({ _id: new ObjectId(id), ...NOT_DELETED }, { projection: { kind: 1 } })
  if (!account) throw createError({ statusCode: 404, message: 'account not found' })
  const isPlatform = account.kind === 'platform'

  if (isPlatform && !session.isPlatformOwner) throw createError({ statusCode: 403, message: 'platform_owner_only' })
  if (!isPlatform && !session.isSuperAdmin) throw createError({ statusCode: 403, message: 'manager_only' })

  const body = await readBody<{ title?: string; features?: Record<string, boolean> }>(event)
  const $set: Record<string, unknown> = { updatedAt: new Date() }

  if (typeof body?.title === 'string') {
    const title = body.title.trim()
    if (!title) throw createError({ statusCode: 400, message: 'title required' })
    $set.title = title
  }

  // Feature entitlements — business accounts only; only known keys, coerced to booleans.
  if (body?.features && typeof body.features === 'object' && !isPlatform) {
    for (const key of FEATURE_KEYS) {
      if (key in body.features) $set[`features.${key}`] = body.features[key] === true
    }
  }

  await accountsCol.updateOne({ _id: new ObjectId(id) }, { $set })
  return { success: true }
})

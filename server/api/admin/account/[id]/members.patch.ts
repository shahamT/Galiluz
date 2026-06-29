import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { NOT_DELETED } from '~/server/utils/eventsQuery'
import { validateMemberChange } from '~/server/utils/accountMembers'

/**
 * Admin: change ONE membership on an account — setRole | add | remove. Gated by plane (platform →
 * platform_owner; business → super_admin) and validated by the pure `validateMemberChange` rules
 * (business keeps ≥1 owner; the platform_owner is immutable). Body: { action, publisherId, role? }.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requirePlatformStaff: true })

  const id = getRouterParam(event, 'id')
  if (!id || !ObjectId.isValid(id)) throw createError({ statusCode: 400, message: 'invalid id' })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const accountsCol = db.collection(config.mongodbCollectionAccounts || 'accounts')
  const membershipsCol = db.collection(config.mongodbCollectionMemberships || 'memberships')
  const publishersCol = db.collection(config.mongodbCollectionPublishers || 'publishers')

  const account = await accountsCol.findOne({ _id: new ObjectId(id), ...NOT_DELETED }, { projection: { kind: 1 } })
  if (!account) throw createError({ statusCode: 404, message: 'account not found' })
  const kind = account.kind === 'platform' ? 'platform' : 'business'

  if (kind === 'platform' && !session.isPlatformOwner) throw createError({ statusCode: 403, message: 'platform_owner_only' })
  if (kind === 'business' && !session.isSuperAdmin) throw createError({ statusCode: 403, message: 'manager_only' })

  const body = await readBody<{ action?: string; publisherId?: string; role?: string }>(event)
  const action = body?.action
  const publisherId = typeof body?.publisherId === 'string' ? body.publisherId.trim() : ''
  const role = typeof body?.role === 'string' ? body.role.trim() : undefined
  if (!['setRole', 'add', 'remove'].includes(String(action))) throw createError({ statusCode: 400, message: 'invalid action' })
  if (!publisherId || !ObjectId.isValid(publisherId)) throw createError({ statusCode: 400, message: 'publisherId required' })

  // Current members of this account (this plane's roles), for the invariant checks.
  const memberRows = await membershipsCol.find({ accountId: id, status: 'active' }, { projection: { publisherId: 1, role: 1 } }).toArray()
  const members = memberRows.map((m) => ({ publisherId: String(m.publisherId), role: String(m.role) }))

  // For 'add', the target publisher must exist.
  if (action === 'add') {
    const exists = await publishersCol.countDocuments({ _id: new ObjectId(publisherId) })
    if (!exists) throw createError({ statusCode: 404, message: 'publisher not found' })
  }

  const verdict = validateMemberChange(kind, members, { action: action as 'setRole' | 'add' | 'remove', publisherId, role })
  if (!verdict.ok) throw createError({ statusCode: 400, message: verdict.reason })

  const now = new Date()
  if (action === 'remove') {
    // Every publisher must keep ≥1 account — refuse to remove their LAST membership.
    const otherCount = await membershipsCol.countDocuments({ publisherId, accountId: { $ne: id }, status: 'active' })
    if (otherCount < 1) throw createError({ statusCode: 400, message: 'publisher_needs_one_account' })
    await membershipsCol.deleteOne({ publisherId, accountId: id })
    // If their default-active-account pointer named this account, repoint it to a remaining membership.
    const pubDoc = await publishersCol.findOne({ _id: new ObjectId(publisherId) }, { projection: { accountId: 1 } })
    if (pubDoc?.accountId === id) {
      const other = await membershipsCol.findOne({ publisherId, status: 'active' }, { projection: { accountId: 1 } })
      await publishersCol.updateOne({ _id: new ObjectId(publisherId) }, { $set: { accountId: other?.accountId || null } })
    }
  } else {
    // Ownership transfer: demote the previous owner to admin first (single-owner invariant).
    if (verdict.transferFrom) {
      await membershipsCol.updateOne(
        { publisherId: verdict.transferFrom, accountId: id },
        { $set: { role: 'admin', updatedAt: now } },
      )
    }
    // add or setRole — upsert the (publisher, account) row to the new role.
    await membershipsCol.updateOne(
      { publisherId, accountId: id },
      { $set: { role: verdict.nextRole, status: 'active', updatedAt: now }, $setOnInsert: { publisherId, accountId: id, createdAt: now } },
      { upsert: true },
    )
  }

  console.info(`[admin/members] ${session.waId} ${action} pub=${publisherId} acct=${id} role=${verdict.nextRole || '-'} (${kind})`)
  return { success: true }
})

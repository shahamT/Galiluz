import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { NOT_DELETED } from '~/server/utils/eventsQuery'
import { ensureMembership } from '~/server/utils/accountScope'

/**
 * Admin (super_admin/owner): delete a BUSINESS account.
 *  - The platform account can never be deleted.
 *  - Empty account (no active members) → soft-delete directly.
 *  - Account WITH members → require `targetAccountId` (another business account); move every member there
 *    with the SAME role (the owner becomes a regular admin), move the account's live events to the target,
 *    then soft-delete the source. Existing target memberships are never downgraded.
 *
 * Body: { targetAccountId? }.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requireSuperAdmin: true })
  const id = getRouterParam(event, 'id')
  if (!id || !ObjectId.isValid(id)) throw createError({ statusCode: 400, message: 'invalid id' })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const accountsCol = db.collection(config.mongodbCollectionAccounts || 'accounts')
  const membershipsCol = db.collection(config.mongodbCollectionMemberships || 'memberships')
  const publishersCol = db.collection(config.mongodbCollectionPublishers || 'publishers')
  const eventsCol = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')

  const account = await accountsCol.findOne({ _id: new ObjectId(id), ...NOT_DELETED })
  if (!account) throw createError({ statusCode: 404, message: 'account not found' })
  if (account.kind === 'platform') throw createError({ statusCode: 400, message: 'cannot_delete_platform' })

  const members = await membershipsCol.find({ accountId: id, status: 'active' }, { projection: { publisherId: 1, role: 1 } }).toArray()
  const now = new Date()
  let movedUsers = 0
  let movedEvents = 0

  if (members.length > 0) {
    const body = await readBody<{ targetAccountId?: string }>(event)
    const targetAccountId = typeof body?.targetAccountId === 'string' ? body.targetAccountId.trim() : ''
    if (!targetAccountId || !ObjectId.isValid(targetAccountId)) throw createError({ statusCode: 400, message: 'target_required' })
    if (targetAccountId === id) throw createError({ statusCode: 400, message: 'invalid_target' })
    const target = await accountsCol.findOne({ _id: new ObjectId(targetAccountId), ...NOT_DELETED }, { projection: { kind: 1 } })
    if (!target || target.kind === 'platform') throw createError({ statusCode: 400, message: 'invalid_target' })

    // Move each member to the target with the same role (owner → admin). ensureMembership never downgrades
    // an existing target role, so a publisher already in the target keeps their (possibly higher) role.
    for (const m of members) {
      const mappedRole = m.role === 'owner' ? 'admin' : m.role
      await ensureMembership(String(m.publisherId), targetAccountId, mappedRole)
      movedUsers += 1
    }
    // Single-owner safety: if the target somehow has no owner, promote the moved (ex-)owner so it isn't
    // left ownerless (normal targets already have an owner; this only triggers on abnormal data).
    const targetHasOwner = await membershipsCol.countDocuments({ accountId: targetAccountId, role: 'owner', status: 'active' })
    if (!targetHasOwner) {
      const sourceOwner = members.find((m) => m.role === 'owner')
      if (sourceOwner) {
        await membershipsCol.updateOne({ publisherId: String(sourceOwner.publisherId), accountId: targetAccountId }, { $set: { role: 'owner', updatedAt: now } })
      }
    }
    // Repoint the default-active-account for members still pointing at the deleted account.
    const memberObjIds = members.map((m) => m.publisherId).filter((x) => ObjectId.isValid(x)).map((x) => new ObjectId(x))
    if (memberObjIds.length) {
      await publishersCol.updateMany({ _id: { $in: memberObjIds }, accountId: id }, { $set: { accountId: targetAccountId, updatedAt: now } })
    }
    // Move the account's live events to the target (tenant key).
    const res = await eventsCol.updateMany({ 'event.accountId': id, ...NOT_DELETED }, { $set: { 'event.accountId': targetAccountId, updatedAt: now } })
    movedEvents = res.modifiedCount

    await membershipsCol.deleteMany({ accountId: id })
  }

  await accountsCol.updateOne({ _id: new ObjectId(id) }, { $set: { deletedAt: now, isActive: false, deletedByName: session.fullName || 'מנהל', updatedAt: now } })
  console.info(`[admin/account] ${session.waId} deleted account ${id} (movedUsers=${movedUsers}, movedEvents=${movedEvents})`)
  return { success: true, movedUsers, movedEvents }
})

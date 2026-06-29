import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { NOT_DELETED } from '~/server/utils/eventsQuery'
import { ensureAccountForPublisher } from '~/server/utils/accountScope'
import { resolveExposedContactPhone } from '~/server/utils/contactPhone'
import { getEventLogsCollection } from '~/server/utils/eventLogs.service'
import { restampEventStatsPublisher } from '~/server/utils/eventStats.service'

/**
 * Admin: SILENTLY delete a publisher — transfer ALL their events to another publisher (+ that
 * publisher's account), then soft-delete the source publisher (kept for audit) + remove its
 * memberships + release its now-empty account(s). No WhatsApp notice. (super_admin/owner)
 *
 * Body: { targetPublisherId }. Guards: can't delete yourself or the platform owner; target must exist + differ.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requireSuperAdmin: true })
  const id = getRouterParam(event, 'id')
  if (!id || !ObjectId.isValid(id)) throw createError({ statusCode: 400, message: 'invalid id' })

  const body = await readBody<{ targetPublisherId?: string }>(event)
  const targetPublisherId = typeof body?.targetPublisherId === 'string' ? body.targetPublisherId.trim() : ''
  if (!targetPublisherId || !ObjectId.isValid(targetPublisherId)) throw createError({ statusCode: 400, message: 'targetPublisherId required' })
  if (targetPublisherId === id) throw createError({ statusCode: 400, message: 'target must differ' })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const publishersCol = db.collection(config.mongodbCollectionPublishers || 'publishers')
  const membershipsCol = db.collection(config.mongodbCollectionMemberships || 'memberships')
  const accountsCol = db.collection(config.mongodbCollectionAccounts || 'accounts')
  const eventsCol = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')

  const source = await publishersCol.findOne({ _id: new ObjectId(id), ...NOT_DELETED })
  if (!source) throw createError({ statusCode: 404, message: 'publisher not found' })
  const target = await publishersCol.findOne({ _id: new ObjectId(targetPublisherId), ...NOT_DELETED })
  if (!target) throw createError({ statusCode: 404, message: 'target publisher not found' })
  if (target.isActive === false) throw createError({ statusCode: 400, message: 'target_inactive' })

  if (id === session.publisherId) throw createError({ statusCode: 400, message: 'cannot_delete_self' })
  // Deleting a platform staffer is owner-only governance; the platform_owner is never deletable.
  const targetPlatformRole = (await membershipsCol.findOne(
    { publisherId: id, role: { $in: ['platform_owner', 'super_admin', 'viewer'] }, status: 'active' },
    { projection: { role: 1 } },
  ))?.role
  if (targetPlatformRole === 'platform_owner') throw createError({ statusCode: 400, message: 'cannot_delete_owner' })
  if (targetPlatformRole && !session.isPlatformOwner) throw createError({ statusCode: 403, message: 'platform_staff_owner_only' })

  const now = new Date()
  const sourceWaId = source.waId || ''
  const newWaId = (target as Record<string, unknown>).waId as string || (target as Record<string, unknown>).phone as string || ''
  const newAccountId = await ensureAccountForPublisher({ _id: new ObjectId(targetPublisherId), accountId: (target as Record<string, unknown>).accountId, accountName: (target as Record<string, unknown>).accountName, waId: newWaId } as Parameters<typeof ensureAccountForPublisher>[0])

  // Transfer every (non-deleted) event of the source to the target + target's account.
  const theirEvents = await eventsCol
    .find({ $or: [{ 'event.publisherId': id }, { 'rawEvent.publisher.waId': sourceWaId }], ...NOT_DELETED })
    .toArray()

  const logs = await getEventLogsCollection().catch(() => null)
  const transferredIds: string[] = []
  let transferred = 0
  for (const doc of theirEvents) {
    const previousPublisherId = doc.event?.publisherId || ''
    const previousAccountId = doc.event?.accountId || ''
    const $set: Record<string, unknown> = {
      'event.publisherId': targetPublisherId,
      'event.accountId': newAccountId,
      'event.publisherPhone': resolveExposedContactPhone({
        showContactPhone: doc.event?.showContactPhone,
        customContactPhone: doc.event?.customContactPhone,
        ownWaId: newWaId,
      }),
      updatedAt: now,
    }
    if (!doc.event?.originalCreatorPublisherId && previousPublisherId) $set['event.originalCreatorPublisherId'] = previousPublisherId
    if (doc.rawEvent?.publisherId !== undefined) $set['rawEvent.publisherId'] = targetPublisherId
    if (doc.rawEvent?.publisher && typeof doc.rawEvent.publisher === 'object') {
      $set['rawEvent.publisher.publisherId'] = targetPublisherId
      if (newWaId) $set['rawEvent.publisher.waId'] = newWaId
    }
    await eventsCol.updateOne({ _id: doc._id }, { $set })
    transferredIds.push(doc._id.toString())
    transferred += 1
    if (logs) {
      await logs.insertOne({
        createdAt: now, eventId: doc._id.toString(), action: 'event_transferred',
        publisherId: targetPublisherId, previousPublisherId, previousAccountId,
        waId: session.waId, actingManagerPublisherId: session.publisherId, isManagerAction: true,
      }).catch(() => {})
    }
  }

  // Transferred events' stats follow the new owner (denormalized publisherId), so nothing keeps
  // pointing at the deleted publisher.
  await restampEventStatsPublisher(transferredIds, targetPublisherId)

  // The source's account(s), captured before we drop its memberships (to release empties after).
  const sourceMemberships = await membershipsCol.find({ publisherId: id }, { projection: { accountId: 1 } }).toArray()
  const sourceAccountIds = [...new Set(sourceMemberships.map((m) => String(m.accountId)).filter(Boolean))]

  // Soft-delete the publisher (kept for audit) + kill any session, opt OUT of the crawler list, drop memberships.
  await publishersCol.updateOne(
    { _id: new ObjectId(id) },
    { $set: { deletedAt: now, isActive: false, deletedByName: session.fullName || 'מנהל', updatedAt: now, 'preferences.autoGenerateDraftsByCrawler': false }, $unset: { authKey: '', authKeyExpiresAt: '' } },
  )
  await membershipsCol.deleteMany({ publisherId: id })

  // Remove from the approvers list (delete removes; deactivate would keep it).
  await db.collection(config.mongodbCollectionAppSettings || 'appSettings')
    .updateOne({ key: 'approvers' }, { $pull: { publisherIds: id } })
    .catch(() => {})

  // Release any of the source's accounts that are now empty (no active members), except the target's.
  for (const accId of sourceAccountIds) {
    if (accId === newAccountId) continue
    const remaining = await membershipsCol.countDocuments({ accountId: accId, status: 'active' })
    if (remaining === 0 && ObjectId.isValid(accId)) {
      await accountsCol.updateOne({ _id: new ObjectId(accId) }, { $set: { deletedAt: now, isActive: false } }).catch(() => {})
    }
  }

  console.info(`[admin/publisher] ${session.waId} deleted ${id}, transferred ${transferred} events → ${targetPublisherId}`)
  return { success: true, transferred }
})

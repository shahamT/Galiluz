import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'
import { softDeleteEventStatsData } from '~/server/utils/eventStats.service'
import { logAuthEvent } from '~/server/utils/authLog'
import { resolveActorName } from '~/server/utils/approvers'

/**
 * Reject a publisher. ATOMIC first-wins: only a still-`pending` publisher is claimed (→ 'rejected',
 * recording the actor) before the cascade runs, so a concurrent approve/reject can't also win.
 * Cascade = soft-delete the publisher's events + stats, then ghost (on-behalf) or hard-delete the
 * publisher (+ membership/account cleanup). `reason` is only for the bot's message to the publisher.
 *
 * Body: { waId, actorWaId?, reason? }. Response: { applied:true, publisherName, actorName } on win,
 * or { applied:false, resolvedStatus, by, publisherName } when someone already acted.
 */
export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const body = await readBody<{ waId?: string; actorWaId?: string; reason?: string }>(event)
  const waId = typeof body?.waId === 'string' ? body.waId.trim() : ''
  const actorWaId = typeof body?.actorWaId === 'string' ? body.actorWaId.trim() : ''

  if (!waId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'waId is required' })
  }

  const config = useRuntimeConfig()
  const mongoUri = config.mongodbUri || process.env.MONGODB_URI
  const mongoDbName = config.mongodbDbName || process.env.MONGODB_DB_NAME
  const collectionName =
    config.mongodbCollectionPublishers || process.env.MONGODB_COLLECTION_PUBLISHERS || 'publishers'
  if (!mongoUri || !mongoDbName) {
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
  }

  try {
    const { db } = await getMongoConnection()
    const collection = db.collection(collectionName)
    const now = new Date()
    const actorName = actorWaId ? await resolveActorName(actorWaId) : 'מאשר'

    // Atomic first-wins claim: pending → rejected. Only the winner gets the doc + runs the cascade.
    const doc = await collection.findOneAndUpdate(
      { waId, status: 'pending' },
      { $set: { status: 'rejected', rejectedAt: now, updatedAt: now, rejectedByWaId: actorWaId || null, rejectedByName: actorName } },
      { returnDocument: 'after' },
    )

    if (!doc) {
      // Loser: someone already acted (or the publisher is gone).
      const current = await collection.findOne(
        { waId },
        { projection: { status: 1, fullName: 1, approvedByName: 1, rejectedByName: 1 } },
      )
      if (!current) return { applied: false, resolvedStatus: 'gone', by: null, publisherName: '' }
      const resolvedStatus =
        current.status === 'approved' ? 'approved'
          : current.status === 'rejected' || current.status === 'ghost' ? 'rejected'
            : String(current.status || 'unknown')
      const by = resolvedStatus === 'approved' ? (current.approvedByName || null)
        : resolvedStatus === 'rejected' ? (current.rejectedByName || null) : null
      return { applied: false, resolvedStatus, by, publisherName: current.fullName || '' }
    }

    // Winner: cascade soft-delete the publisher's events + stats.
    const eventsCol = db.collection(
      (config.mongodbCollectionEventsWaBot as string) || (config.mongodbCollectionEvents as string) || 'events',
    )
    const publisherId = doc._id.toString()
    const deletedAt = now
    const theirEvents = await eventsCol
      .find(
        { $or: [{ 'event.publisherId': publisherId }, { 'rawEvent.publisher.waId': waId }], deletedAt: { $exists: false } },
        { projection: { _id: 1 } },
      )
      .toArray()
    for (const ev of theirEvents) {
      await eventsCol.updateOne({ _id: ev._id }, { $set: { deletedAt, isActive: false } })
      await softDeleteEventStatsData(ev._id.toString(), deletedAt)
    }

    if (doc.createdOnBehalf) {
      // Ghost records keep their doc (+ the rejectedBy stamp from the claim) so they can be re-surfaced.
      await collection.updateOne({ waId }, { $set: { status: 'ghost', updatedAt: now } })
    } else {
      await collection.deleteOne({ waId })
      const membershipsCol = db.collection((config.mongodbCollectionMemberships as string) || 'memberships')
      await membershipsCol.deleteMany({ publisherId })
      if (doc.accountId) {
        const remaining = await collection.countDocuments({ accountId: doc.accountId })
        if (remaining === 0) {
          try {
            const accountsCol = db.collection((config.mongodbCollectionAccounts as string) || 'accounts')
            await accountsCol.updateOne(
              { _id: new ObjectId(String(doc.accountId)) },
              { $set: { deletedAt: now, isActive: false } },
            )
          } catch (e) {
            console.warn('[PublishersAPI] Reject: could not release account', doc.accountId, e instanceof Error ? e.message : e)
          }
        }
      }
    }

    await logAuthEvent(event, 'publisher_rejected', waId, { cascadedEvents: theirEvents.length })
    return { applied: true, publisherName: doc.fullName || '', actorName }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    console.error('[PublishersAPI] Reject error:', err instanceof Error ? err.message : String(err))
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
  }
})

import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { softDeleteEventStatsData } from '~/server/utils/eventStats.service'

/**
 * Admin TEST TOOL (super-admin only): remove everything created by the approver test harness —
 * every `isTestDummy:true` publisher plus the account + memberships an approval created for it.
 * (A rejected dummy is already hard-deleted by reject.post.ts; this handles approved/pending leftovers.)
 */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requirePlatformOwner: true })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const publishers = db.collection(config.mongodbCollectionPublishers || 'publishers')
  const accounts = db.collection(config.mongodbCollectionAccounts || 'accounts')
  const memberships = db.collection(config.mongodbCollectionMemberships || 'memberships')
  const events = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')

  const dummies = await publishers.find({ isTestDummy: true }, { projection: { _id: 1, accountId: 1 } }).toArray()
  let removed = 0
  for (const d of dummies) {
    const publisherId = d._id.toString()
    // Soft-delete any events (none expected for a dummy) + their stats.
    const evs = await events.find({ 'event.publisherId': publisherId, deletedAt: { $exists: false } }, { projection: { _id: 1 } }).toArray()
    for (const ev of evs) {
      await events.updateOne({ _id: ev._id }, { $set: { deletedAt: new Date(), isActive: false } })
      await softDeleteEventStatsData(ev._id.toString(), new Date())
    }
    await memberships.deleteMany({ publisherId })
    if (d.accountId) {
      try { await accounts.deleteOne({ _id: new ObjectId(String(d.accountId)) }) } catch { /* ignore bad id */ }
    }
    await publishers.deleteOne({ _id: d._id })
    removed++
  }

  return { success: true, removed }
})

import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { NOT_DELETED } from '~/server/utils/eventsQuery'

/**
 * Admin (platform-staff READ): every account with its publisher + event counts, for the
 * Accounts management list. Sorted by Hebrew title. Counts come from one aggregation each
 * (memberships by accountId, events by event.accountId) rather than N per-account queries.
 */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requirePlatformStaff: true })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const accountsCol = db.collection(config.mongodbCollectionAccounts || 'accounts')
  const membershipsCol = db.collection(config.mongodbCollectionMemberships || 'memberships')
  const eventsCol = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')

  const [accountDocs, memberCounts, eventCounts] = await Promise.all([
    accountsCol.find(NOT_DELETED).toArray(),
    membershipsCol.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$accountId', count: { $sum: 1 } } },
    ]).toArray(),
    eventsCol.aggregate([
      { $match: NOT_DELETED },
      { $group: { _id: '$event.accountId', count: { $sum: 1 } } },
    ]).toArray(),
  ])

  const memberById = new Map<string, number>(memberCounts.map((m) => [String(m._id), m.count]))
  const eventById = new Map<string, number>(eventCounts.map((e) => [String(e._id), e.count]))
  const collator = new Intl.Collator('he')

  const accounts = accountDocs
    .map((a) => {
      const id = a._id.toString()
      return {
        id,
        title: a.title || '',
        kind: a.kind === 'platform' ? 'platform' : 'business',
        isActive: a.isActive !== false,
        logo: a.logo || '',
        publisherCount: memberById.get(id) || 0,
        eventCount: eventById.get(id) || 0,
      }
    })
    // Platform account first, then business accounts by Hebrew title.
    .sort((x, y) => {
      if (x.kind !== y.kind) return x.kind === 'platform' ? -1 : 1
      return collator.compare(x.title, y.title)
    })

  return { accounts }
})

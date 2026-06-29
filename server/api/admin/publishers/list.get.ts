import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { NOT_DELETED } from '~/server/utils/eventsQuery'

const PLATFORM_ROLES = new Set(['platform_owner', 'super_admin', 'viewer'])
const BUSINESS_ROLES = new Set(['owner', 'admin'])

/**
 * Admin (platform-staff READ): every publisher enriched for the management list — account + role
 * (business owner/admin AND platform role), status, active, and #events. Roles come from the
 * `memberships` source of truth (one fetch, grouped), counts from one events aggregation.
 */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requirePlatformStaff: true })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const publishersCol = db.collection(config.mongodbCollectionPublishers || 'publishers')
  const accountsCol = db.collection(config.mongodbCollectionAccounts || 'accounts')
  const membershipsCol = db.collection(config.mongodbCollectionMemberships || 'memberships')
  const eventsCol = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')

  const [publisherDocs, accountDocs, membershipDocs, eventCounts] = await Promise.all([
    publishersCol.find(NOT_DELETED, {
      projection: { _id: 1, waId: 1, fullName: 1, email: 1, status: 1, isActive: 1, accountId: 1, accountName: 1, createdAt: 1 },
    }).toArray(),
    accountsCol.find(NOT_DELETED, { projection: { _id: 1, title: 1 } }).toArray(),
    membershipsCol.find({ status: 'active' }, { projection: { publisherId: 1, accountId: 1, role: 1 } }).toArray(),
    eventsCol.aggregate([
      { $match: NOT_DELETED },
      { $group: { _id: '$event.publisherId', count: { $sum: 1 } } },
    ]).toArray(),
  ])

  const accountNameById = new Map<string, string>(accountDocs.map((a) => [a._id.toString(), a.title || '']))
  const eventByPub = new Map<string, number>(eventCounts.map((e) => [String(e._id), e.count]))

  // publisherId → { businessRole, platformRole } from memberships (the role source of truth).
  const rolesByPub = new Map<string, { businessRole: string | null; platformRole: string | null }>()
  for (const m of membershipDocs) {
    const pid = String(m.publisherId)
    const entry = rolesByPub.get(pid) || { businessRole: null, platformRole: null }
    if (PLATFORM_ROLES.has(m.role)) entry.platformRole = m.role
    else if (BUSINESS_ROLES.has(m.role) && !entry.businessRole) entry.businessRole = m.role
    rolesByPub.set(pid, entry)
  }

  const collator = new Intl.Collator('he')
  const publishers = publisherDocs
    .map((p) => {
      const id = p._id.toString()
      const accountName = p.accountId ? (accountNameById.get(p.accountId) || '') : (p.accountName || '')
      const roles = rolesByPub.get(id) || { businessRole: null, platformRole: null }
      return {
        id,
        name: p.fullName || accountName || p.waId || '',
        phone: p.waId || '',
        email: p.email || '',
        status: p.status || '',
        isActive: p.isActive !== false,
        accountId: p.accountId || '',
        accountName,
        businessRole: roles.businessRole,
        platformRole: roles.platformRole,
        eventCount: eventByPub.get(id) || 0,
        createdAt: p.createdAt || null,
      }
    })
    .sort((x, y) => collator.compare(x.name, y.name))

  return { publishers }
})

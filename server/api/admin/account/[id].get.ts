import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { NOT_DELETED } from '~/server/utils/eventsQuery'

const ROLE_ORDER: Record<string, number> = { platform_owner: 0, owner: 0, super_admin: 1, admin: 1, viewer: 2 }

/**
 * Admin (platform-staff READ): one account + its members (publishers with their role IN this account),
 * resolved from `memberships` (the source of truth), plus the account's event count + feature flags.
 */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requirePlatformStaff: true })

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

  const memberRows = await membershipsCol.find({ accountId: id, status: 'active' }, { projection: { publisherId: 1, role: 1 } }).toArray()
  const pubIds = memberRows.map((m) => m.publisherId).filter((x) => ObjectId.isValid(x)).map((x) => new ObjectId(x))
  const pubDocs = pubIds.length
    ? await publishersCol.find({ _id: { $in: pubIds } }, { projection: { _id: 1, fullName: 1, waId: 1, status: 1, isActive: 1 } }).toArray()
    : []
  const pubById = new Map(pubDocs.map((p) => [p._id.toString(), p]))

  const eventCount = await eventsCol.countDocuments({ 'event.accountId': id, ...NOT_DELETED })
  const collator = new Intl.Collator('he')

  const members = memberRows
    .map((m) => {
      const p = pubById.get(String(m.publisherId))
      return {
        publisherId: String(m.publisherId),
        name: p?.fullName || p?.waId || String(m.publisherId),
        phone: p?.waId || '',
        role: m.role,
        status: p?.status || '',
        isActive: p ? p.isActive !== false : true,
      }
    })
    .sort((a, b) => {
      const r = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9)
      return r !== 0 ? r : collator.compare(a.name, b.name)
    })

  return {
    account: {
      id,
      title: account.title || '',
      kind: account.kind === 'platform' ? 'platform' : 'business',
      isActive: account.isActive !== false,
      logo: account.logo || '',
      features: account.features || {},
      createdAt: account.createdAt || null,
      eventCount,
    },
    members,
  }
})

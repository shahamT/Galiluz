import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { NOT_DELETED } from '~/server/utils/eventsQuery'

const ROLE_ORDER: Record<string, number> = { platform_owner: 0, owner: 0, super_admin: 1, admin: 1, viewer: 2 }

/**
 * Admin (platform-staff READ): one publisher's profile + the accounts they belong to (with their role
 * in each) + their (non-deleted) event count. Powers the publisher detail / lifecycle page.
 */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requirePlatformStaff: true })

  const id = getRouterParam(event, 'id')
  if (!id || !ObjectId.isValid(id)) throw createError({ statusCode: 400, message: 'invalid id' })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const publishersCol = db.collection(config.mongodbCollectionPublishers || 'publishers')
  const accountsCol = db.collection(config.mongodbCollectionAccounts || 'accounts')
  const membershipsCol = db.collection(config.mongodbCollectionMemberships || 'memberships')
  const eventsCol = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')

  const p = await publishersCol.findOne({ _id: new ObjectId(id), ...NOT_DELETED })
  if (!p) throw createError({ statusCode: 404, message: 'publisher not found' })

  const memberRows = await membershipsCol.find({ publisherId: id, status: 'active' }, { projection: { accountId: 1, role: 1 } }).toArray()
  const acctIds = memberRows.map((m) => m.accountId).filter((x) => ObjectId.isValid(x)).map((x) => new ObjectId(x))
  const acctDocs = acctIds.length
    ? await accountsCol.find({ _id: { $in: acctIds } }, { projection: { _id: 1, title: 1, kind: 1 } }).toArray()
    : []
  const acctById = new Map(acctDocs.map((a) => [a._id.toString(), a]))

  const eventCount = await eventsCol.countDocuments({ 'event.publisherId': id, ...NOT_DELETED })

  const accounts = memberRows
    .map((m) => {
      const a = acctById.get(String(m.accountId))
      return { accountId: String(m.accountId), title: a?.title || String(m.accountId), kind: a?.kind === 'platform' ? 'platform' : 'business', role: m.role }
    })
    .sort((x, y) => (ROLE_ORDER[x.role] ?? 9) - (ROLE_ORDER[y.role] ?? 9))

  const isPlatformOwner = memberRows.some((m) => m.role === 'platform_owner')
  // Any platform role → managing this publisher's lifecycle (deactivate/delete) is owner-only.
  const isPlatformStaff = memberRows.some((m) => ['platform_owner', 'super_admin', 'viewer'].includes(m.role))

  return {
    publisher: {
      id,
      name: p.fullName || p.waId || id,
      phone: p.waId || '',
      email: p.email || '',
      eventTypesDescription: p.eventTypesDescription || '',
      status: p.status || '',
      isActive: p.isActive !== false,
      isPlatformOwner,
      isPlatformStaff,
      createdAt: p.createdAt || null,
      eventCount,
    },
    accounts,
  }
})

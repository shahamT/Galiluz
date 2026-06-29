import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { NOT_DELETED } from '~/server/utils/eventsQuery'

/**
 * Admin (platform-staff READ): the publisher-registration approval queue — publishers awaiting
 * a decision (`status: 'pending'`). Oldest first (FIFO). Approve/deny actions land in Stage 3.
 */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requirePlatformStaff: true })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const publishersCol = db.collection(config.mongodbCollectionPublishers || 'publishers')

  const docs = await publishersCol
    .find(
      { status: 'pending', ...NOT_DELETED },
      { projection: { _id: 1, waId: 1, fullName: 1, email: 1, eventTypesDescription: 1, accountName: 1, createdAt: 1 } },
    )
    .sort({ createdAt: 1 })
    .toArray()

  const pending = docs.map((p) => ({
    id: p._id.toString(),
    name: p.fullName || '',
    phone: p.waId || '',
    email: p.email || '',
    eventTypesDescription: p.eventTypesDescription || '',
    accountName: p.accountName || '',
    createdAt: p.createdAt || null,
  }))

  return { pending, count: pending.length }
})

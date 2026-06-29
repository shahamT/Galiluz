import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { NOT_DELETED } from '~/server/utils/eventsQuery'

/** Admin (platform-staff READ): count of pending registrations — drives the nav/sub-tab badge. */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requirePlatformStaff: true })
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const count = await db.collection(config.mongodbCollectionPublishers || 'publishers')
    .countDocuments({ status: 'pending', ...NOT_DELETED })
  return { count }
})

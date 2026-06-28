import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { getApprovers } from '~/server/utils/approvers'

/**
 * Admin: read the configured approvers (resolved to name + phone). Platform-staff readable.
 * `noApprovers` is true when none are configured (so no one is notified). `testDummyCount` surfaces
 * leftover test data.
 */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requirePlatformStaff: true })
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const approvers = await getApprovers()
  const testDummyCount = await db
    .collection(config.mongodbCollectionPublishers || 'publishers')
    .countDocuments({ isTestDummy: true })
  return { approvers, noApprovers: approvers.length === 0, testDummyCount }
})

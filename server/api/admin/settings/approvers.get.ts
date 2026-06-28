import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { getAppSetting } from '~/server/utils/appSettings'
import { getApprovers } from '~/server/utils/approvers'

/**
 * Admin: read the configured approvers (resolved to name + phone). Platform-staff readable.
 * `usingEnvFallback` is true when no approvers are configured yet and the legacy env approver
 * (PUBLISHERS_APPROVER_WA_NUMBER) is standing in. `testDummyCount` surfaces leftover test data.
 */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requirePlatformStaff: true })
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const doc = await getAppSetting('approvers')
  const configuredCount = Array.isArray(doc?.publisherIds) ? (doc!.publisherIds as unknown[]).length : 0
  const approvers = await getApprovers()
  const testDummyCount = await db
    .collection(config.mongodbCollectionPublishers || 'publishers')
    .countDocuments({ isTestDummy: true })
  return { approvers, usingEnvFallback: configuredCount === 0, testDummyCount }
})

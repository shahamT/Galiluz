import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { getAppSettingsCollection } from '~/server/utils/appSettings'

/** Admin: remove an approver (by publisherId) from the approvers list. Super-admin only. */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requireSuperAdmin: true })
  const publisherId = getRouterParam(event, 'publisherId')
  if (!publisherId) throw createError({ statusCode: 400, message: 'publisherId required' })

  const col = await getAppSettingsCollection()
  await col.updateOne(
    { key: 'approvers' },
    { $pull: { publisherIds: publisherId }, $set: { updatedAt: new Date(), updatedBy: session.publisherId } },
  )
  return { success: true }
})

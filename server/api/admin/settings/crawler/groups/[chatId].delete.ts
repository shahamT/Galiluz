import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { getAppSettingsCollection } from '~/server/utils/appSettings'

/** Admin: remove a WhatsApp group from the crawler watch-list. Manager-only. */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requireManager: true })
  const chatId = decodeURIComponent(getRouterParam(event, 'chatId') || '').trim()
  if (!chatId) throw createError({ statusCode: 400, message: 'chatId required' })

  const col = await getAppSettingsCollection()
  await col.updateOne(
    { key: 'crawler' },
    { $pull: { groups: { chatId } }, $set: { updatedAt: new Date(), updatedBy: session.publisherId } },
  )
  return { success: true }
})

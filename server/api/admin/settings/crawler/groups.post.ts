import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { getAppSettingsCollection } from '~/server/utils/appSettings'

/** Admin: add a WhatsApp group to the crawler watch-list (idempotent). Manager-only. */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requireManager: true })
  const body = await readBody<{ chatId?: string; name?: string }>(event)
  const chatId = typeof body?.chatId === 'string' ? body.chatId.trim() : ''
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!chatId || !chatId.endsWith('@g.us')) {
    throw createError({ statusCode: 400, message: 'invalid group chatId' })
  }

  const col = await getAppSettingsCollection()
  // Ensure the crawler settings doc exists.
  await col.updateOne(
    { key: 'crawler' },
    { $setOnInsert: { key: 'crawler', enabled: false, groups: [], createdAt: new Date() } },
    { upsert: true },
  )
  // Add only if not already present (idempotent).
  await col.updateOne(
    { key: 'crawler', 'groups.chatId': { $ne: chatId } },
    {
      $push: { groups: { chatId, name, addedAt: new Date(), addedBy: session.publisherId } },
      $set: { updatedAt: new Date(), updatedBy: session.publisherId },
    },
  )
  return { success: true }
})

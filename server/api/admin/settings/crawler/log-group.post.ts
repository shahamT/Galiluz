import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { setAppSetting } from '~/server/utils/appSettings'

/**
 * Admin: set (or clear) the WhatsApp group that crawler AI-decision logs are posted to.
 * Body `{ chatId, name }` — a valid `@g.us` chatId selects it; an empty chatId clears it.
 * Super-admin only. The on/off toggle is separate (`logDecisions` via crawler.patch).
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requireSuperAdmin: true })
  const body = await readBody<{ chatId?: string; name?: string }>(event)
  const chatId = typeof body?.chatId === 'string' ? body.chatId.trim() : ''
  const name = typeof body?.name === 'string' ? body.name.trim() : ''

  if (chatId && !chatId.endsWith('@g.us')) {
    throw createError({ statusCode: 400, message: 'invalid group chatId' })
  }

  await setAppSetting(
    'crawler',
    { logGroupChatId: chatId, logGroupName: chatId ? name : '' },
    session.publisherId,
  )
  return { success: true, logGroup: chatId ? { chatId, name } : null }
})

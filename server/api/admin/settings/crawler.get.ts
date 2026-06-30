import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { getAppSetting } from '~/server/utils/appSettings'

/** Admin: read crawler settings (global toggle + managed groups). Manager-only. */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requirePlatformStaff: true })
  const doc = await getAppSetting('crawler')
  const groups = Array.isArray(doc?.groups) ? (doc.groups as Array<Record<string, unknown>>) : []
  return {
    enabled: doc?.enabled === true,
    groups: groups.map((g) => ({ chatId: g.chatId, name: g.name })),
    // Crawler AI-decision logging (prod-only): on/off toggle + the target WhatsApp group.
    logDecisions: doc?.logDecisions === true,
    logGroup: doc?.logGroupChatId
      ? { chatId: doc.logGroupChatId as string, name: (doc.logGroupName as string) || (doc.logGroupChatId as string) }
      : null,
    // Channel for the "we drafted your event" notice sent to the publisher (default WhatsApp).
    draftNoticeMethod: doc?.draftNoticeMethod === 'sms' ? 'sms' : 'whatsapp',
  }
})

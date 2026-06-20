import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { getAppSetting } from '~/server/utils/appSettings'

/** Admin: read crawler settings (global toggle + managed groups). Manager-only. */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requireManager: true })
  const doc = await getAppSetting('crawler')
  const groups = Array.isArray(doc?.groups) ? (doc.groups as Array<Record<string, unknown>>) : []
  return {
    enabled: doc?.enabled === true,
    groups: groups.map((g) => ({ chatId: g.chatId, name: g.name })),
  }
})

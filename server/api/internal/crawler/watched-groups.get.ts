import { requireApiSecret } from '~/server/utils/requireApiSecret'
import { getAppSetting } from '~/server/utils/appSettings'

/**
 * Internal (API_SECRET): the crawler's enabled flag + watched group chatIds.
 * The wa-gateway polls this to cache which groups to forward (noise/cost filter);
 * the ingest endpoint re-validates authoritatively.
 */
export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const doc = await getAppSetting('crawler')
  const groups = Array.isArray(doc?.groups) ? (doc.groups as Array<Record<string, unknown>>) : []
  return {
    enabled: doc?.enabled === true,
    groupChatIds: groups.map((g) => g.chatId).filter((id): id is string => typeof id === 'string'),
  }
})

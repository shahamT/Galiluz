import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { setAppSetting } from '~/server/utils/appSettings'

/** Admin: toggle the crawler on/off globally. Manager-only. */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requireSuperAdmin: true })
  const body = await readBody<{ enabled?: unknown }>(event)
  const enabled = body?.enabled === true
  await setAppSetting('crawler', { enabled }, session.publisherId)
  return { success: true, enabled }
})

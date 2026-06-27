import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { setAppSetting } from '~/server/utils/appSettings'

/**
 * Admin: toggle crawler settings. Sets ONLY the fields present in the body (so toggling one flag
 * never wipes another) — `enabled` (global on/off) and/or `logDecisions` (AI-decision logging).
 * Super-admin only.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requireSuperAdmin: true })
  const body = await readBody<{ enabled?: unknown; logDecisions?: unknown }>(event)

  const patch: Record<string, boolean> = {}
  if (body && 'enabled' in body) patch.enabled = body.enabled === true
  if (body && 'logDecisions' in body) patch.logDecisions = body.logDecisions === true
  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, message: 'no settable field provided' })
  }

  await setAppSetting('crawler', patch, session.publisherId)
  return { success: true, ...patch }
})

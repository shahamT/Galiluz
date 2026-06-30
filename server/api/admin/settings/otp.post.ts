import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { setAppSetting } from '~/server/utils/appSettings'

/**
 * Admin: set the OTP delivery method. Super-admin only. Body: { method: 'whatsapp' | 'sms' }.
 * SMS requires the PULSEEM_* env vars to be set (see pulseem.ts) — otherwise SMS sends fail.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requireSuperAdmin: true })
  const body = await readBody<{ method?: unknown }>(event)
  const method = body?.method === 'sms' ? 'sms' : body?.method === 'whatsapp' ? 'whatsapp' : null
  if (!method) throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid_method' })

  await setAppSetting('otp', { method }, session.publisherId)
  console.info(`[admin/settings] ${session.waId} set OTP method = ${method}`)
  return { success: true, method }
})

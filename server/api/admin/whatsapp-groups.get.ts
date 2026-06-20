import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'

/**
 * Admin: list the WhatsApp groups the business number belongs to (live, via the
 * gateway → Green API getContacts). Manager-only. Used by the add-group picker.
 */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requireManager: true })

  const config = useRuntimeConfig() as Record<string, string>
  const gatewayUrl = (config.waGatewayUrl || process.env.WA_GATEWAY_URL || '').replace(/\/$/, '')
  const apiSecret = config.apiSecret || process.env.API_SECRET || ''
  if (!gatewayUrl) throw createError({ statusCode: 503, message: 'gateway_not_configured' })

  try {
    const res = await $fetch<{ groups: Array<{ chatId: string; name: string }> }>(`${gatewayUrl}/internal/groups`, {
      headers: { 'x-api-secret': apiSecret },
      timeout: 15000,
    })
    return { groups: Array.isArray(res?.groups) ? res.groups : [] }
  } catch (err) {
    console.error('[admin/whatsapp-groups] gateway error:', err instanceof Error ? err.message : String(err))
    throw createError({ statusCode: 502, message: 'gateway_error' })
  }
})

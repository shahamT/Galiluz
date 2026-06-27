/**
 * Post a plain operational notice to a WhatsApp group via the gateway (Green API). Fire-and-forget:
 * never throws — a delivery failure is logged, not surfaced, so it can't break the request that
 * triggered it. By default it targets the gateway's `LOG_GROUP_CHAT_ID`; pass `targetChatId` to
 * send to a specific group instead (e.g. the crawler-decision log group). No-op if the gateway URL
 * is unset (e.g. dev without a gateway).
 */
export async function notifyLog(message: string, targetChatId?: string): Promise<void> {
  if (!message) return
  const config = useRuntimeConfig() as Record<string, string>
  const gatewayUrl = (config.waGatewayUrl || process.env.WA_GATEWAY_URL || '').replace(/\/$/, '')
  const apiSecret = config.apiSecret || process.env.API_SECRET || ''

  if (!gatewayUrl) {
    console.info('[log] WA_GATEWAY_URL unset — log notice skipped')
    return
  }
  try {
    await $fetch(`${gatewayUrl}/internal/log`, {
      method: 'POST',
      headers: { 'x-api-secret': apiSecret },
      body: targetChatId ? { message, groupChatId: targetChatId } : { message },
      timeout: 15000,
    })
  } catch (err) {
    console.error('[log] gateway log notice failed:', err instanceof Error ? err.message : String(err))
  }
}

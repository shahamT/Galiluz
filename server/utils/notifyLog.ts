/**
 * Post a plain operational notice to the dedicated WhatsApp "log" group via the gateway
 * (Green API). Fire-and-forget: never throws — a delivery failure is logged, not surfaced,
 * so it can't break the request that triggered it. The log group's chatId lives in the
 * gateway config (LOG_GROUP_CHAT_ID); callers only send a message. No-op if the gateway URL
 * is unset (e.g. dev without a gateway).
 */
export async function notifyLog(message: string): Promise<void> {
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
      body: { message },
      timeout: 15000,
    })
  } catch (err) {
    console.error('[log] gateway log notice failed:', err instanceof Error ? err.message : String(err))
  }
}

/**
 * Thin helper for the web app → wa-gateway internal API (API_SECRET, x-api-secret header).
 * Mirrors the OTP/crawler call pattern. Throws 503 when the gateway URL isn't configured.
 */
export async function callGateway<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
  const config = useRuntimeConfig() as Record<string, string>
  const gatewayUrl = (config.waGatewayUrl || process.env.WA_GATEWAY_URL || '').replace(/\/$/, '')
  const apiSecret = config.apiSecret || process.env.API_SECRET || ''
  if (!gatewayUrl) throw createError({ statusCode: 503, statusMessage: 'Service Unavailable', message: 'gateway_unconfigured' })
  return $fetch<T>(`${gatewayUrl}${path}`, {
    method: 'POST',
    headers: { 'x-api-secret': apiSecret },
    body,
  })
}

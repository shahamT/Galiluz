import type { H3Event } from 'h3'
import { timingSafeEqual } from 'node:crypto'

/**
 * Requires the request to provide the API secret via X-API-Key header.
 * In production (NODE_ENV=production), if API_SECRET is not set, returns 503 so the route cannot be used without configuration.
 * Uses timing-safe comparison to avoid leaking the secret length.
 */
export function requireApiSecret(event: H3Event): void {
  const config = useRuntimeConfig()
  const secret = config.apiSecret
  const isProduction = process.env.NODE_ENV === 'production'

  if (!secret) {
    if (isProduction) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Service Unavailable',
        message: 'API_SECRET is required in production. Set API_SECRET in the environment.',
      })
    }
    return
  }

  const headerKey = getHeader(event, 'x-api-key')
  const provided = typeof headerKey === 'string' ? headerKey : null

  if (!provided) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const secretBuf = Buffer.from(secret, 'utf8')
  const providedBuf = Buffer.from(provided, 'utf8')
  if (secretBuf.length !== providedBuf.length || !timingSafeEqual(secretBuf, providedBuf)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }
}

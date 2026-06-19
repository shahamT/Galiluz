import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'

/**
 * Timing-safe check of the shared API secret on an inbound request.
 * Accepts the secret via `x-api-secret` header or `Authorization: Bearer <secret>`.
 * Hashing both sides to equal-length buffers keeps timingSafeEqual happy
 * regardless of input length.
 * @returns {boolean}
 */
export function checkApiSecret(req) {
  const expected = config.apiSecret
  if (!expected) return false

  const headerVal = req.headers['x-api-secret']
  const auth = req.headers['authorization'] || ''
  const provided = (typeof headerVal === 'string' && headerVal)
    || (auth.startsWith('Bearer ') ? auth.slice(7) : '')
  if (!provided) return false

  const a = createHmac('sha256', expected).update(provided).digest()
  const b = createHmac('sha256', expected).update(expected).digest()
  return a.length === b.length && timingSafeEqual(a, b)
}

import { checkRateLimit } from '~/server/utils/rateLimit'

/**
 * Global rate limiter for all /api/ routes.
 * Skips /api/health (used by Render health probes at high frequency).
 * Centralizes rate limiting so all routes — public and admin — are protected.
 */
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/')) return
  if (path === '/api/health') return
  await checkRateLimit(event)
})

import { getRequestIP } from 'h3'
import { atomicUpdateEntry } from './rateLimitFileStore'

/** Max requests per IP per window for general API routes. */
const RATE_LIMIT_MAX = 100
/** Window duration in milliseconds. */
const RATE_LIMIT_WINDOW_MS = 60_000

/** Stricter limits for auth endpoints (send-otp, verify-otp). */
const AUTH_RATE_LIMIT_MAX = 10
const AUTH_RATE_LIMIT_WINDOW_MS = 5 * 60_000  // 5 minutes

const memoryStore = new Map<string, { count: number; resetAt: number }>()

function checkMemoryLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now()
  const entry = memoryStore.get(key)
  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  entry.count += 1
  if (entry.count > max) {
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' })
  }
}

/**
 * Stricter rate limit for auth endpoints: 10 requests per IP per 5 minutes.
 */
export async function checkAuthRateLimit(event: Parameters<typeof getRequestIP>[0]): Promise<void> {
  const ip = getRequestIP(event, { xForwardedFor: true })
  const key = `auth:${ip ?? 'unknown'}`
  const now = Date.now()
  const filePath = process.env.RATE_LIMIT_FILE_PATH

  if (filePath) {
    const entry = await atomicUpdateEntry(filePath, key, (current) => {
      if (!current || current.resetAt < now) return { count: 1, resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS }
      return { count: current.count + 1, resetAt: current.resetAt }
    })
    if (entry.count > AUTH_RATE_LIMIT_MAX) {
      throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' })
    }
    return
  }

  checkMemoryLimit(key, AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW_MS)
}

/**
 * Best-effort rate limit for general API routes.
 * Uses in-memory store by default; when RATE_LIMIT_FILE_PATH is set, persists to that file (survives restarts).
 * Throws 429 if the client IP exceeds the limit.
 */
export async function checkRateLimit(event: Parameters<typeof getRequestIP>[0]): Promise<void> {
  const ip = getRequestIP(event, { xForwardedFor: true })
  const key = `general:${ip ?? 'unknown'}`
  const now = Date.now()
  const filePath = process.env.RATE_LIMIT_FILE_PATH

  if (filePath) {
    const entry = await atomicUpdateEntry(filePath, key, (current) => {
      if (!current || current.resetAt < now) return { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS }
      return { count: current.count + 1, resetAt: current.resetAt }
    })
    if (entry.count > RATE_LIMIT_MAX) {
      throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' })
    }
    return
  }

  checkMemoryLimit(key, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
}

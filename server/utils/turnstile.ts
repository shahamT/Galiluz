import type { H3Event } from 'h3'
import { getRequestIP } from 'h3'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

let warnedUnconfigured = false

/**
 * Verify a Cloudflare Turnstile token. Env-gated: when TURNSTILE_SECRET_KEY is
 * unset, verification is skipped (one-time warning) so dev needs zero setup.
 * Fail-closed: this guards paid WhatsApp messaging — a missing/invalid token is
 * 403, and a siteverify outage is 503 rather than letting traffic through.
 */
export async function verifyTurnstileToken(event: H3Event, token: unknown): Promise<void> {
  // Dev is silently exempt — must mirror the client (useTurnstile renders no
  // widget in dev, so no token exists to verify).
  if (process.env.NODE_ENV !== 'production') {
    if (!warnedUnconfigured) {
      console.warn('[Turnstile] dev mode — captcha verification skipped')
      warnedUnconfigured = true
    }
    return
  }

  const config = useRuntimeConfig()
  const secret = (config as Record<string, string>).turnstileSecretKey || ''

  if (!secret) {
    if (!warnedUnconfigured) {
      console.warn('[Turnstile] secret not configured — captcha verification disabled')
      warnedUnconfigured = true
    }
    return
  }

  const response = typeof token === 'string' ? token.trim() : ''
  if (!response || response.length > 2048) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'captcha_failed' })
  }

  try {
    const body = new URLSearchParams({ secret, response })
    const ip = getRequestIP(event, { xForwardedFor: true })
    if (ip) body.set('remoteip', ip)

    const result = await $fetch<{ success: boolean; 'error-codes'?: string[] }>(SITEVERIFY_URL, {
      method: 'POST',
      body,
      timeout: 5000,
    })

    if (!result?.success) {
      console.warn('[Turnstile] verification failed:', result?.['error-codes']?.join(',') || 'unknown')
      throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'captcha_failed' })
    }
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    console.error('[Turnstile] siteverify unreachable:', err instanceof Error ? err.message : err)
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable', message: 'captcha_unavailable' })
  }
}

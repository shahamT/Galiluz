import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import type { Collection, Document } from 'mongodb'

/**
 * Shared OTP machinery for phone verification. Used by BOTH the login flow
 * (send-otp / verify-otp — approved publishers only) and the website registration
 * flow (pending/new publishers). The status gate and what happens on success
 * (login issues a session; registration just marks phoneVerified) stay in the
 * callers — this util owns generation, hashing, the per-phone block + send cap,
 * delivery, and verification.
 */

export const OTP_EXPIRY_MS = 10 * 60 * 1000        // 10 minutes
export const OTP_SEND_LIMIT = 5                     // max OTPs per phone per hour
export const OTP_SEND_WINDOW_MS = 60 * 60 * 1000    // 1 hour window
export const MAX_VERIFY_ATTEMPTS = 5
export const BLOCK_MS = 30 * 60 * 1000              // 30 minutes
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000     // min gap between sends to one phone

type PubCollection = Collection<Document>
type PubDoc = Record<string, any> | null | undefined

/** Normalize an Israeli phone to a `972XXXXXXXXX` waId, or null if not valid. */
export function normaliseIsraeliPhone(raw: string): string | null {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.startsWith('972') && digits.length === 12) return digits
  if (digits.startsWith('05') && digits.length === 10) return '972' + digits.slice(1)
  if (digits.startsWith('5') && digits.length === 9) return '972' + digits
  return null
}

function otpSecret(): string {
  const config = useRuntimeConfig() as Record<string, string>
  return config.otpSecret || process.env.OTP_SECRET || ''
}

/** HMAC-SHA256 hash of an OTP (only the hash is stored at rest). */
export function hashOtp(otp: string): string {
  return createHmac('sha256', otpSecret()).update(otp).digest('hex')
}

/**
 * Generate a fresh OTP for `waId`, store its hash + expiry on the doc, and return
 * the plaintext. Enforces the per-phone block, a 60s resend cooldown, and the 5/hour
 * send cap (throws 429 `blocked:<secs>` / `resend_cooldown:<secs>` / `send_limit:<mins>`).
 * Does NOT reset otpAttempts and does NOT clear otpBlockedUntil (those expire naturally
 * / reset on successful verify). `doc` must carry otpBlockedUntil/otpExpiresAt/
 * otpSentCount/otpSentWindowStart.
 */
export async function generateAndStoreOtp(col: PubCollection, waId: string, doc: PubDoc, now: Date): Promise<string> {
  if (doc?.otpBlockedUntil && doc.otpBlockedUntil > now) {
    const secondsLeft = Math.ceil((doc.otpBlockedUntil.getTime() - now.getTime()) / 1000)
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', message: `blocked:${secondsLeft}` })
  }

  // Min 60s between sends to the same phone, so a duplicate/accidental send isn't a
  // hard block — the caller surfaces the wait. Derived from otpExpiresAt, which the
  // caller clears on a successful verify (so a fresh flow after success is never gated).
  if (doc?.otpExpiresAt instanceof Date) {
    const sinceLastSendMs = now.getTime() - (doc.otpExpiresAt.getTime() - OTP_EXPIRY_MS)
    if (sinceLastSendMs < OTP_RESEND_COOLDOWN_MS) {
      const secondsLeft = Math.ceil((OTP_RESEND_COOLDOWN_MS - sinceLastSendMs) / 1000)
      throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', message: `resend_cooldown:${secondsLeft}` })
    }
  }

  const windowStart = doc?.otpSentWindowStart instanceof Date ? doc.otpSentWindowStart : new Date(0)
  const inWindow = now.getTime() - windowStart.getTime() < OTP_SEND_WINDOW_MS
  const sentCount = inWindow ? (doc?.otpSentCount ?? 0) : 0
  if (sentCount >= OTP_SEND_LIMIT) {
    const resetAt = Math.ceil((windowStart.getTime() + OTP_SEND_WINDOW_MS - now.getTime()) / 60_000)
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', message: `send_limit:${resetAt}` })
  }

  // Fixed OTP only in dev when ALLOW_FIXED_DEV_OTP=1 is explicitly set.
  const useFixedOtp = process.env.NODE_ENV !== 'production' && process.env.ALLOW_FIXED_DEV_OTP === '1'
  const otp = useFixedOtp ? '111111' : randomInt(100000, 1000000).toString()

  await col.updateOne(
    { waId },
    {
      $set: {
        otp: hashOtp(otp),
        otpExpiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
        otpSentCount: sentCount + 1,
        otpSentWindowStart: inWindow ? windowStart : now,
      },
    },
  )
  return otp
}

/**
 * Send the OTP through the WhatsApp gateway (Green API bridge). In dev (no gateway)
 * it prints to the Nuxt terminal; in production a missing gateway throws 503. OTP is
 * already stored, so a transient delivery failure is logged, not thrown (user retries).
 */
export async function sendOtpViaGateway(waId: string, otp: string): Promise<void> {
  const config = useRuntimeConfig() as Record<string, string>
  const gatewayUrl = (config.waGatewayUrl || process.env.WA_GATEWAY_URL || '').replace(/\/$/, '')
  const apiSecret = config.apiSecret || process.env.API_SECRET || ''

  // In dev, always echo the OTP to the terminal so it's readable even when a gateway is
  // configured (which would otherwise swallow it). The dev OTP is fixed to 111111 when
  // ALLOW_FIXED_DEV_OTP=1. Production never logs the code.
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[Auth][DEV] OTP for ${waId}: ${otp}`)
  }

  if (gatewayUrl) {
    try {
      const res = await fetch(`${gatewayUrl}/internal/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-secret': apiSecret },
        body: JSON.stringify({ phone: waId, otp }),
      })
      if (!res.ok) {
        console.error(`[Auth] Gateway OTP send failed (${res.status}): ${(await res.text()).slice(0, 200)}`)
      }
    } catch (err) {
      console.error('[Auth] Failed to reach WhatsApp gateway:', err instanceof Error ? err.message : String(err))
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('[Auth] CRITICAL: WA_GATEWAY_URL missing in production — OTP not sent')
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable', message: 'messaging_unavailable' })
  }
}

/**
 * Verify a submitted OTP against the stored hash. Owns block/expiry checks, the
 * timing-safe compare, and the failed-attempt counter + block-at-5 write. Throws
 * 429 `blocked` / 400 `otp_expired` / 401 `invalid_otp:<left>` on failure. On
 * success it returns; the CALLER performs its own success `$set/$unset` (login sets
 * authKey; registration sets phoneVerified — both should reset otpAttempts and unset
 * otp/otpExpiresAt/otpBlockedUntil).
 */
export async function verifyStoredOtp(col: PubCollection, waId: string, doc: PubDoc, submittedOtp: string, now: Date): Promise<void> {
  if (doc?.otpBlockedUntil && doc.otpBlockedUntil > now) {
    const secondsLeft = Math.ceil((doc.otpBlockedUntil.getTime() - now.getTime()) / 1000)
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', message: `blocked:${secondsLeft}` })
  }
  if (!doc?.otp || !doc.otpExpiresAt || doc.otpExpiresAt <= now) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'otp_expired' })
  }

  const expectedBuf = Buffer.from(hashOtp(submittedOtp), 'hex')
  const storedBuf = Buffer.from(String(doc.otp), 'hex')
  const match = expectedBuf.length === storedBuf.length && timingSafeEqual(expectedBuf, storedBuf)

  if (!match) {
    const newAttempts = (doc.otpAttempts ?? 0) + 1
    const blocked = newAttempts >= MAX_VERIFY_ATTEMPTS
    await col.updateOne(
      { waId },
      { $set: { otpAttempts: newAttempts, ...(blocked ? { otpBlockedUntil: new Date(now.getTime() + BLOCK_MS) } : {}) } },
    )
    if (blocked) {
      throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', message: `blocked:${BLOCK_MS / 1000}` })
    }
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: `invalid_otp:${MAX_VERIFY_ATTEMPTS - newAttempts}` })
  }
}

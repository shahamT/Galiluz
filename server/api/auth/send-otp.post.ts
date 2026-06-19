import { createHmac, randomInt } from 'node:crypto'
import { getMongoConnection } from '~/server/utils/mongodb'
import { checkAuthRateLimit, checkPhoneRateLimit } from '~/server/utils/rateLimit'
import { logAuthEvent } from '~/server/utils/authLog'
import { verifyTurnstileToken } from '~/server/utils/turnstile'

const OTP_EXPIRY_MS = 10 * 60 * 1000       // 10 minutes
const OTP_SEND_LIMIT = 5                    // max OTPs per phone per hour
const OTP_SEND_WINDOW_MS = 60 * 60 * 1000  // 1 hour window

function normaliseIsraeliPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('972') && digits.length === 12) return digits
  if (digits.startsWith('05') && digits.length === 10) return '972' + digits.slice(1)
  if (digits.startsWith('5') && digits.length === 9) return '972' + digits
  return null
}

export default defineEventHandler(async (event) => {
  await checkAuthRateLimit(event)

  // CSRF: strict origin check in production (exact host match, missing Origin rejected)
  if (process.env.NODE_ENV === 'production') {
    const originHeader = getHeader(event, 'origin') ?? ''
    const host = (getHeader(event, 'host') ?? '').toLowerCase()
    let originHost = ''
    try { originHost = originHeader ? new URL(originHeader).host.toLowerCase() : '' } catch {}
    if (!originHost || originHost !== host) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'invalid_origin' })
    }
  }

  const body = await readBody<{ phone?: string; turnstileToken?: string }>(event)

  // Bot gate before any DB work — this endpoint triggers paid WhatsApp messages
  await verifyTurnstileToken(event, body?.turnstileToken)

  const raw = typeof body?.phone === 'string' ? body.phone.trim() : ''
  const waId = normaliseIsraeliPhone(raw)

  if (!waId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid_phone' })
  }

  // Per-phone rate limit (distributed attack protection)
  checkPhoneRateLimit(waId)

  const config = useRuntimeConfig()
  if (!config.mongodbUri || !config.mongodbDbName) {
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
  }

  const { db } = await getMongoConnection()
  const col = db.collection(config.mongodbCollectionPublishers || 'publishers')
  const doc = await col.findOne({ waId }, { projection: { status: 1, otpBlockedUntil: 1, otpSentCount: 1, otpSentWindowStart: 1 } })

  if (!doc || doc.status !== 'approved') {
    console.info(`[Auth] OTP request for unregistered/unapproved phone: ${waId}`)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'not_registered' })
  }

  const now = new Date()

  // Check OTP block
  if (doc.otpBlockedUntil && doc.otpBlockedUntil > now) {
    const secondsLeft = Math.ceil((doc.otpBlockedUntil.getTime() - now.getTime()) / 1000)
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', message: `blocked:${secondsLeft}` })
  }

  // Check per-phone send-rate limit
  const windowStart = doc.otpSentWindowStart instanceof Date ? doc.otpSentWindowStart : new Date(0)
  const inWindow = now.getTime() - windowStart.getTime() < OTP_SEND_WINDOW_MS
  const sentCount = inWindow ? (doc.otpSentCount ?? 0) : 0

  if (sentCount >= OTP_SEND_LIMIT) {
    const resetAt = Math.ceil((windowStart.getTime() + OTP_SEND_WINDOW_MS - now.getTime()) / 60_000)
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', message: `send_limit:${resetAt}` })
  }

  // Generate OTP — fixed in dev only when ALLOW_FIXED_DEV_OTP=1 is explicitly set
  const useFixedOtp = process.env.NODE_ENV !== 'production' && process.env.ALLOW_FIXED_DEV_OTP === '1'
  const otp = useFixedOtp ? '111111' : randomInt(100000, 1000000).toString()
  const secret = config.otpSecret || process.env.OTP_SECRET || ''
  const otpHash = createHmac('sha256', secret).update(otp).digest('hex')
  const otpExpiresAt = new Date(now.getTime() + OTP_EXPIRY_MS)

  await col.updateOne(
    { waId },
    {
      $set: {
        otp: otpHash,
        otpExpiresAt,
        // Do NOT reset otpAttempts here — each OTP gets its own 5 attempts but
        // resetting allows 5×N attempts. Counter resets only on successful login.
        // Do NOT clear otpBlockedUntil here — block must expire naturally.
        otpSentCount: sentCount + 1,
        otpSentWindowStart: inWindow ? windowStart : now,
      },
    },
  )

  // Send via the WhatsApp Gateway (Green API bridge). The gateway can message
  // cold users (no 24h-window/template restriction), unlike the old Cloud API
  // text path. OTP is already stored, so a delivery failure is non-fatal — the
  // user can retry — but we log it rather than swallowing it blindly.
  const gatewayUrl = (config.waGatewayUrl || process.env.WA_GATEWAY_URL || '').replace(/\/$/, '')
  const apiSecret = config.apiSecret || process.env.API_SECRET || ''

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
      // Don't expose the error — OTP is stored, user can retry
    }
  } else if (process.env.NODE_ENV === 'production') {
    // Production without a gateway URL — should never happen (startup check catches it)
    console.error('[Auth] CRITICAL: WA_GATEWAY_URL missing in production — OTP not sent')
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable', message: 'messaging_unavailable' })
  } else {
    // Dev mode only (gated by NODE_ENV !== 'production')
    console.info(`[Auth][DEV] OTP for ${waId}: ${otp}`)
  }

  await logAuthEvent(event, 'otp_sent', waId)
  return { success: true }
})

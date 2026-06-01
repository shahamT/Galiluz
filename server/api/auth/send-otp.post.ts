import { createHmac, randomInt } from 'node:crypto'
import { getMongoConnection } from '~/server/utils/mongodb'
import { checkAuthRateLimit, checkPhoneRateLimit } from '~/server/utils/rateLimit'
import { logAuthEvent } from '~/server/utils/authLog'

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

  // CSRF: reject cross-origin POST in production
  const origin = getHeader(event, 'origin') ?? ''
  const host = getHeader(event, 'host') ?? ''
  if (process.env.NODE_ENV === 'production' && origin && !origin.includes(host)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'invalid_origin' })
  }

  const body = await readBody<{ phone?: string }>(event)
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
    // Return success silently — never reveal whether a phone is registered
    console.info(`[Auth] OTP request for unregistered/unapproved phone: ${waId}`)
    return { success: true }
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

  // Generate OTP
  const otp = randomInt(100000, 1000000).toString()
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

  // Send via WhatsApp Cloud API
  const accessToken = config.waCloudAccessToken || process.env.WA_CLOUD_ACCESS_TOKEN || ''
  const phoneNumberId = config.waPhoneNumberId || process.env.WA_PHONE_NUMBER_ID || ''

  if (accessToken && phoneNumberId) {
    try {
      await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: waId,
          type: 'text',
          text: { body: `קוד האימות שלך לגלילו"ז: *${otp}*\nהקוד תקף ל-10 דקות.` },
        }),
      })
    } catch (err) {
      console.error('[Auth] Failed to send OTP via WhatsApp:', err instanceof Error ? err.message : String(err))
      // Don't expose the error — OTP is stored, user can retry
    }
  } else if (process.env.NODE_ENV === 'production') {
    // Production with missing WA credentials — this should never happen (startup check catches it)
    console.error('[Auth] CRITICAL: WA credentials missing in production — OTP not sent')
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable', message: 'messaging_unavailable' })
  } else {
    // Dev mode only (gated by NODE_ENV !== 'production')
    console.info(`[Auth][DEV] OTP for ${waId}: ${otp}`)
  }

  await logAuthEvent(event, 'otp_sent', waId)
  return { success: true }
})

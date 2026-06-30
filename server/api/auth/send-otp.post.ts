import { getMongoConnection } from '~/server/utils/mongodb'
import { checkAuthRateLimit, checkPhoneRateLimit } from '~/server/utils/rateLimit'
import { logAuthEvent } from '~/server/utils/authLog'
import { verifyTurnstileToken } from '~/server/utils/turnstile'
import { normaliseIsraeliPhone, generateAndStoreOtp, deliverOtp } from '~/server/utils/otp'

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

  const waId = normaliseIsraeliPhone(typeof body?.phone === 'string' ? body.phone : '')
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
  const doc = await col.findOne({ waId }, { projection: { status: 1, isActive: 1, otpBlockedUntil: 1, otpExpiresAt: 1, otpSentCount: 1, otpSentWindowStart: 1 } })

  // Login is for APPROVED, ACTIVE publishers only. (Registration uses its own public endpoints;
  // a deactivated publisher keeps its data but cannot receive an OTP / log in.)
  if (!doc || doc.status !== 'approved' || doc.isActive === false) {
    console.info(`[Auth] OTP request for unregistered/unapproved/inactive phone: ${waId}`)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'not_registered' })
  }

  const now = new Date()
  const otp = await generateAndStoreOtp(col, waId, doc, now)
  await deliverOtp(waId, otp)

  await logAuthEvent(event, 'otp_sent', waId)
  return { success: true }
})

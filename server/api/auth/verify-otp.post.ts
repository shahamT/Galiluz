import { createHmac, randomBytes } from 'node:crypto'
import { getMongoConnection } from '~/server/utils/mongodb'
import { checkAuthRateLimit, checkPhoneRateLimit } from '~/server/utils/rateLimit'
import { logAuthEvent } from '~/server/utils/authLog'
import { getAccountFeatures } from '~/server/utils/accountFeatures'
import { getPublisherPreferences } from '~/server/utils/publisherPreferences'
import { resolveAccountTitle, resolvePublisherRoles } from '~/server/utils/accountScope'
import { normaliseIsraeliPhone, verifyStoredOtp } from '~/server/utils/otp'

const AUTH_KEY_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

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

  const body = await readBody<{ phone?: string; otp?: string }>(event)
  const submittedOtp = typeof body?.otp === 'string' ? body.otp.trim() : ''
  const waId = normaliseIsraeliPhone(typeof body?.phone === 'string' ? body.phone : '')

  if (!waId || !submittedOtp || !/^\d{6}$/.test(submittedOtp)) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid_input' })
  }

  // Per-phone rate limit (distributed attack protection)
  checkPhoneRateLimit(waId)

  const config = useRuntimeConfig()
  const { db } = await getMongoConnection()
  const col = db.collection(config.mongodbCollectionPublishers || 'publishers')

  const doc = await col.findOne({ waId })
  if (!doc || doc.status !== 'approved' || doc.isActive === false) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'not_registered' })
  }

  const now = new Date()
  // Throws on block / expired / invalid (and writes the failed-attempt counter).
  await verifyStoredOtp(col, waId, doc, submittedOtp, now)

  // OTP correct — issue session token
  const token = randomBytes(32).toString('hex')
  const secret = config.otpSecret || process.env.OTP_SECRET || ''
  const authKey = createHmac('sha256', secret).update(token).digest('hex')
  const authKeyExpiresAt = new Date(now.getTime() + AUTH_KEY_EXPIRY_MS)

  await col.updateOne(
    { waId },
    {
      $set: { authKey, authKeyExpiresAt, otpAttempts: 0 },
      $unset: { otp: '', otpExpiresAt: '', otpBlockedUntil: '' },
    },
  )

  // Set HttpOnly cookie — token never exposed to JavaScript
  setCookie(event, 'galiluz_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api',
    maxAge: 3600,
  })

  await logAuthEvent(event, 'login', waId)

  // Roles + active account, derived fresh from memberships (same resolver the session uses).
  const roles = await resolvePublisherRoles({ publisherId: doc._id.toString(), accountId: doc.accountId })

  return {
    expiresAt: authKeyExpiresAt.toISOString(),
    user: {
      waId: doc.waId,
      fullName: doc.fullName || '',
      publishingAs: await resolveAccountTitle({ accountId: roles.activeAccountId, accountName: doc.accountName, waId: doc.waId }),
      platformRole: roles.platformRole,
      activeAccountId: roles.activeAccountId,
      activeRole: roles.activeRole,
      // Resolved here so the client has entitlements immediately after login,
      // without waiting for a /api/auth/me round-trip.
      features: await getAccountFeatures({ activeAccountId: roles.activeAccountId, platformRole: roles.platformRole }),
      preferences: getPublisherPreferences(doc),
    },
  }
})

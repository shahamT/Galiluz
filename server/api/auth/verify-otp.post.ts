import { createHmac, randomBytes } from 'node:crypto'
import { getMongoConnection } from '~/server/utils/mongodb'
import { checkAuthRateLimit, checkPhoneRateLimit } from '~/server/utils/rateLimit'
import { logAuthEvent } from '~/server/utils/authLog'
import { getAccountFeatures } from '~/server/utils/accountFeatures'
import { getPublisherPreferences } from '~/server/utils/publisherPreferences'
import { resolveAccountTitle, resolvePublisherRoles } from '~/server/utils/accountScope'
import { normaliseIsraeliPhone, verifyStoredOtp } from '~/server/utils/otp'
import { listCredentials, buildAuthenticationOptions, hashMfaToken, MFA_PENDING_TTL_MS, CHALLENGE_TTL_MS } from '~/server/utils/webauthn'

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

  // OTP correct. Resolve roles first — platform STAFF must clear a second factor (passkey)
  // before a usable session is minted (true MFA). Roles are derived fresh from memberships.
  const publisherId = doc._id.toString()
  const roles = await resolvePublisherRoles({ publisherId, accountId: doc.accountId })
  const secret = config.otpSecret || process.env.OTP_SECRET || ''

  const buildUser = async () => ({
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
  })

  // Mint the real session cookie (used for publishers, and for staff AFTER the passkey step
  // via verify-passkey). Clears the OTP one-shot state + any stale MFA-pending state.
  const issueSession = async (): Promise<string> => {
    const token = randomBytes(32).toString('hex')
    const authKey = createHmac('sha256', secret).update(token).digest('hex')
    const authKeyExpiresAt = new Date(now.getTime() + AUTH_KEY_EXPIRY_MS)
    await col.updateOne(
      { waId },
      {
        $set: { authKey, authKeyExpiresAt, otpAttempts: 0 },
        $unset: { otp: '', otpExpiresAt: '', otpBlockedUntil: '', mfaPendingKey: '', mfaPendingExpiresAt: '', webauthnChallenge: '', webauthnChallengeExpiresAt: '' },
      },
    )
    setCookie(event, 'galiluz_auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api',
      maxAge: 3600,
    })
    return authKeyExpiresAt.toISOString()
  }

  // Platform STAFF with an enrolled passkey → require the assertion. Do NOT mint a session;
  // hand out a short-lived pre-auth token (galiluz_mfa) + an auth challenge. verify-passkey
  // verifies the assertion and only then issues the real galiluz_auth session.
  if (roles.isPlatformStaff) {
    const creds = await listCredentials(publisherId)
    if (creds.length > 0) {
      const authOptions = await buildAuthenticationOptions(creds)
      const mfaToken = randomBytes(32).toString('hex')
      await col.updateOne(
        { waId },
        {
          $set: {
            otpAttempts: 0,
            mfaPendingKey: hashMfaToken(mfaToken),
            mfaPendingExpiresAt: new Date(now.getTime() + MFA_PENDING_TTL_MS),
            webauthnChallenge: authOptions.challenge,
            webauthnChallengeExpiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
          },
          $unset: { otp: '', otpExpiresAt: '', otpBlockedUntil: '' },
        },
      )
      setCookie(event, 'galiluz_mfa', mfaToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth',
        maxAge: Math.floor(MFA_PENDING_TTL_MS / 1000),
      })
      await logAuthEvent(event, 'mfa_challenged', waId)
      return { mfaRequired: true, authOptions }
    }
    // Staff with NO passkey yet (per-staffer auto-migrate grace): issue the session but
    // signal the client to force enrollment before continuing.
    const expiresAt = await issueSession()
    await logAuthEvent(event, 'login', waId, { mfaEnrollRequired: true })
    return { expiresAt, mfaEnrollRequired: true, user: { ...(await buildUser()), mfaEnrollRequired: true } }
  }

  // Regular publisher — issue the session as before.
  const expiresAt = await issueSession()
  await logAuthEvent(event, 'login', waId)
  return { expiresAt, user: await buildUser() }
})

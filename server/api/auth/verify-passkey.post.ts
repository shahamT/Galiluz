import { createHmac, randomBytes } from 'node:crypto'
import { getMongoConnection } from '~/server/utils/mongodb'
import { checkAuthRateLimit } from '~/server/utils/rateLimit'
import { logAuthEvent } from '~/server/utils/authLog'
import { getAccountFeatures } from '~/server/utils/accountFeatures'
import { getPublisherPreferences } from '~/server/utils/publisherPreferences'
import { resolveAccountTitle, resolvePublisherRoles } from '~/server/utils/accountScope'
import { hashMfaToken, verifyAuthentication, type StoredCredential } from '~/server/utils/webauthn'

const AUTH_KEY_EXPIRY_MS = 60 * 60 * 1000 // 1 hour — same as OTP login

/**
 * Step 2 of staff login: verify a WebAuthn passkey assertion against the pre-auth state
 * minted by verify-otp (galiluz_mfa cookie → mfaPendingKey + webauthnChallenge on the doc).
 * Only on success is the real galiluz_auth session issued. Reaching here proves the OTP
 * (factor 1) already passed for this staffer.
 */
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

  const mfaToken = getCookie(event, 'galiluz_mfa')?.trim()
  if (!mfaToken) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'mfa_expired' })
  }

  const body = await readBody<{ response?: unknown }>(event)
  const response = body?.response as Parameters<typeof verifyAuthentication>[0]['response']
  if (!response || typeof response !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid_input' })
  }

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const col = db.collection(config.mongodbCollectionPublishers || 'publishers')
  const credsCol = db.collection(config.mongodbCollectionWebauthnCredentials || 'webauthnCredentials')

  const now = new Date()
  const doc = await col.findOne({ mfaPendingKey: hashMfaToken(mfaToken), mfaPendingExpiresAt: { $gt: now } })
  if (!doc || doc.status !== 'approved' || doc.isActive === false) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'mfa_expired' })
  }
  if (!doc.webauthnChallenge) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'mfa_expired' })
  }

  const publisherId = doc._id.toString()
  const responseId = (response as { id?: string }).id
  const credential = (await credsCol.findOne({ publisherId, credentialId: responseId })) as StoredCredential | null
  if (!credential) {
    await logAuthEvent(event, 'mfa_failed', doc.waId)
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'mfa_failed' })
  }

  let result: { newCounter: number } | null = null
  try {
    result = await verifyAuthentication({ response, expectedChallenge: String(doc.webauthnChallenge), credential })
  } catch {
    result = null
  }
  if (!result) {
    await logAuthEvent(event, 'mfa_failed', doc.waId)
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'mfa_failed' })
  }

  // Passkey verified → bump the signature counter (replay defense) + issue the real session.
  await credsCol.updateOne(
    { publisherId, credentialId: responseId },
    { $set: { counter: result.newCounter, lastUsedAt: now } },
  )

  const token = randomBytes(32).toString('hex')
  const secret = config.otpSecret || process.env.OTP_SECRET || ''
  const authKey = createHmac('sha256', secret).update(token).digest('hex')
  const authKeyExpiresAt = new Date(now.getTime() + AUTH_KEY_EXPIRY_MS)
  await col.updateOne(
    { _id: doc._id },
    {
      $set: { authKey, authKeyExpiresAt },
      $unset: { mfaPendingKey: '', mfaPendingExpiresAt: '', webauthnChallenge: '', webauthnChallengeExpiresAt: '' },
    },
  )

  setCookie(event, 'galiluz_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api',
    maxAge: 3600,
  })
  // Clear the short-lived pre-auth cookie (it lived under /api/auth).
  setCookie(event, 'galiluz_mfa', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth', maxAge: 0 })

  await logAuthEvent(event, 'login', doc.waId, { mfa: 'passkey' })

  const roles = await resolvePublisherRoles({ publisherId, accountId: doc.accountId })
  return {
    expiresAt: authKeyExpiresAt.toISOString(),
    user: {
      waId: doc.waId,
      fullName: doc.fullName || '',
      publishingAs: await resolveAccountTitle({ accountId: roles.activeAccountId, accountName: doc.accountName, waId: doc.waId }),
      platformRole: roles.platformRole,
      activeAccountId: roles.activeAccountId,
      activeRole: roles.activeRole,
      features: await getAccountFeatures({ activeAccountId: roles.activeAccountId, platformRole: roles.platformRole }),
      preferences: getPublisherPreferences(doc),
    },
  }
})

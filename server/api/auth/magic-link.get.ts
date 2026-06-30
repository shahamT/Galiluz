import { randomBytes, createHmac } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { hashMagicToken } from '~/server/utils/magicLink'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { resolvePublisherRoles } from '~/server/utils/accountScope'

const AUTH_KEY_EXPIRY_MS = 60 * 60 * 1000 // 1 hour — same as OTP login

/** Only allow internal-path redirects (block open-redirects). */
function safeTarget(t: unknown): string {
  if (typeof t !== 'string' || !t.startsWith('/') || t.startsWith('//') || t.startsWith('/\\')) {
    return '/publisher/events'
  }
  return t
}

/**
 * GET /api/auth/magic-link?t=<token> — consume a single-use magic link: verify
 * the token, issue the standard 1h session cookie, mark the link used, and
 * redirect to its (validated) internal target. Invalid/expired/used → /login.
 */
export default defineEventHandler(async (event) => {
  await checkRateLimit(event)

  const token = String(getQuery(event).t || '')
  const config = useRuntimeConfig()
  // Empty in dev (matches OTP login); prod enforces OTP_SECRET. Token entropy is the guard.
  const secret = (config as Record<string, string>).otpSecret || process.env.OTP_SECRET || ''
  if (!token) return sendRedirect(event, '/login', 302)

  const { db } = await getMongoConnection()
  const links = db.collection((config as Record<string, string>).mongodbCollectionMagicLinks || 'magicLinks')
  const link = await links.findOne({ tokenHash: hashMagicToken(token, secret) })
  const now = new Date()
  if (!link || link.usedAt || !link.expiresAt || new Date(link.expiresAt) <= now) {
    return sendRedirect(event, '/login?error=link_expired', 302)
  }

  let pubObjId: ObjectId
  try { pubObjId = new ObjectId(String(link.publisherId)) } catch { return sendRedirect(event, '/login', 302) }

  const publishers = db.collection((config as Record<string, string>).mongodbCollectionPublishers || 'publishers')
  // Mirror the OTP/session gate: only an approved, ACTIVE, non-deleted publisher gets a session
  // (a deactivated/soft-deleted publisher must not log in via an outstanding magic link).
  const pub = await publishers.findOne({ _id: pubObjId }, { projection: { status: 1, isActive: 1, deletedAt: 1, accountId: 1 } })
  if (!pub || pub.status !== 'approved' || pub.isActive === false || pub.deletedAt) {
    await links.updateOne({ _id: link._id }, { $set: { usedAt: now } }) // burn it regardless
    return sendRedirect(event, '/login', 302)
  }

  // Platform staff must clear the passkey second factor — a magic link must never mint a staff
  // session that bypasses it. Burn the link and send them through the normal OTP + passkey login.
  const roles = await resolvePublisherRoles({ publisherId: pubObjId.toString(), accountId: pub.accountId })
  if (roles.isPlatformStaff) {
    await links.updateOne({ _id: link._id }, { $set: { usedAt: now } })
    return sendRedirect(event, '/login?error=staff_passkey', 302)
  }

  // Issue a normal session (mirrors verify-otp).
  const sessionToken = randomBytes(32).toString('hex')
  const authKey = createHmac('sha256', secret).update(sessionToken).digest('hex')
  await publishers.updateOne(
    { _id: pubObjId },
    { $set: { authKey, authKeyExpiresAt: new Date(now.getTime() + AUTH_KEY_EXPIRY_MS), otpAttempts: 0 }, $unset: { otp: '', otpExpiresAt: '', otpBlockedUntil: '' } },
  )
  await links.updateOne({ _id: link._id }, { $set: { usedAt: now } }) // single-use

  setCookie(event, 'galiluz_auth', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api',
    maxAge: 3600,
  })

  return sendRedirect(event, safeTarget(link.target), 302)
})

import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { getMongoConnection } from '~/server/utils/mongodb'
import { checkRateLimit } from '~/server/utils/rateLimit'

const MAX_ATTEMPTS = 5
const BLOCK_MS = 30 * 60 * 1000   // 30 minutes
const AUTH_KEY_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

function normaliseIsraeliPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('972') && digits.length === 12) return digits
  if (digits.startsWith('05') && digits.length === 10) return '972' + digits.slice(1)
  if (digits.startsWith('5') && digits.length === 9) return '972' + digits
  return null
}

export default defineEventHandler(async (event) => {
  await checkRateLimit(event)

  const body = await readBody<{ phone?: string; otp?: string }>(event)
  const raw = typeof body?.phone === 'string' ? body.phone.trim() : ''
  const submittedOtp = typeof body?.otp === 'string' ? body.otp.trim() : ''
  const waId = normaliseIsraeliPhone(raw)

  if (!waId || !submittedOtp || !/^\d{6}$/.test(submittedOtp)) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid_input' })
  }

  const config = useRuntimeConfig()
  const { db } = await getMongoConnection()
  const col = db.collection(config.mongodbCollectionPublishers || 'publishers')

  const doc = await col.findOne({ waId })

  if (!doc || doc.status !== 'approved') {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'not_registered' })
  }

  const now = new Date()

  if (doc.otpBlockedUntil && doc.otpBlockedUntil > now) {
    const secondsLeft = Math.ceil((doc.otpBlockedUntil.getTime() - now.getTime()) / 1000)
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', message: `blocked:${secondsLeft}` })
  }

  if (!doc.otp || !doc.otpExpiresAt || doc.otpExpiresAt <= now) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'otp_expired' })
  }

  // Timing-safe OTP comparison
  const secret = config.otpSecret || process.env.OTP_SECRET || ''
  const expectedHash = createHmac('sha256', secret).update(submittedOtp).digest('hex')
  const storedHash = doc.otp as string

  const expectedBuf = Buffer.from(expectedHash, 'hex')
  const storedBuf = Buffer.from(storedHash, 'hex')
  const match = expectedBuf.length === storedBuf.length && timingSafeEqual(expectedBuf, storedBuf)

  if (!match) {
    const newAttempts = (doc.otpAttempts ?? 0) + 1
    const blocked = newAttempts >= MAX_ATTEMPTS
    await col.updateOne(
      { waId },
      {
        $set: {
          otpAttempts: newAttempts,
          ...(blocked ? { otpBlockedUntil: new Date(now.getTime() + BLOCK_MS) } : {}),
        },
      },
    )
    if (blocked) {
      throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', message: `blocked:${BLOCK_MS / 1000}` })
    }
    const attemptsLeft = MAX_ATTEMPTS - newAttempts
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: `invalid_otp:${attemptsLeft}` })
  }

  // OTP correct — issue session token
  const token = randomBytes(32).toString('hex')
  const authKey = createHash('sha256').update(token).digest('hex')
  const authKeyExpiresAt = new Date(now.getTime() + AUTH_KEY_EXPIRY_MS)

  await col.updateOne(
    { waId },
    {
      $set: { authKey, authKeyExpiresAt },
      $unset: { otp: '', otpExpiresAt: '', otpAttempts: '', otpBlockedUntil: '' },
    },
  )

  return {
    token,
    expiresAt: authKeyExpiresAt.toISOString(),
    user: {
      waId: doc.waId,
      fullName: doc.fullName || '',
      publishingAs: doc.publishingAs || '',
      type: doc.type || 'publisher',
    },
  }
})

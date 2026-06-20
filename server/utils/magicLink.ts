import { randomBytes, createHmac } from 'node:crypto'
import { getMongoConnection } from '~/server/utils/mongodb'

const MAGIC_LINK_TTL_MS = 10 * 60 * 1000 // 10 minutes

/** HMAC the raw token so only its hash is stored at rest. */
export function hashMagicToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex')
}

/**
 * Issue a single-use magic login link for a publisher that lands on `target`
 * (a validated internal path). Returns the full URL, or null if unconfigured.
 * High-entropy (32-byte) token, hashed at rest, 10-minute expiry, single-use.
 */
export async function issueMagicLink(publisherId: string, target: string): Promise<string | null> {
  const config = useRuntimeConfig() as Record<string, any>
  // Empty in dev (like OTP); prod enforces OTP_SECRET via startup-checks. Security
  // comes from the 32-byte token entropy — the HMAC just avoids storing it raw.
  const secret = config.otpSecret || process.env.OTP_SECRET || ''

  const token = randomBytes(32).toString('hex')
  const tokenHash = hashMagicToken(token, secret)

  const { db } = await getMongoConnection()
  const col = db.collection(config.mongodbCollectionMagicLinks || 'magicLinks')
  await col.insertOne({
    tokenHash,
    publisherId,
    target,
    expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS),
    usedAt: null,
    createdAt: new Date(),
  })

  const siteUrl = String(config.public?.siteUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  return `${siteUrl}/api/auth/magic-link?t=${token}`
}

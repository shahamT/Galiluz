import { ObjectId } from 'mongodb'
import { randomBytes } from 'node:crypto'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { logAuthEvent } from '~/server/utils/authLog'
import { hashEnrollToken, getRpConfig, ENROLL_TOKEN_TTL_MS } from '~/server/utils/webauthn'

/**
 * Mint a short-lived, single-use cross-device enrollment link. Requires an authenticated staff
 * session — so adding a passkey on a NEW device still requires already being authenticated on an
 * existing one (the OTP+passkey guarantee is never weakened). Opening the link on the new device
 * lets THAT device enroll its own local passkey (see enroll-options / enroll-verify). The token
 * only ADDS a passkey — logging in still needs the WhatsApp OTP — so a leaked link is not a bypass.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requirePlatformStaff: true })

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + ENROLL_TOKEN_TTL_MS)

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const col = db.collection(config.mongodbCollectionPublishers || 'publishers')
  await col.updateOne(
    { _id: new ObjectId(session.publisherId) },
    { $set: { enrollTokenKey: hashEnrollToken(token), enrollTokenExpiresAt: expiresAt } },
  )

  await logAuthEvent(event, 'enroll_link_created', session.waId)
  // Base URL matches the WebAuthn origin exactly (localhost in dev, the site in prod) so the passkey
  // registers against the right rpID.
  const { origin } = getRpConfig()
  return { url: `${origin}/enroll-passkey?t=${token}`, expiresAt: expiresAt.toISOString() }
})

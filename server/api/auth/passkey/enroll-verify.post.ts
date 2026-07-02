import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { logAuthEvent } from '~/server/utils/authLog'
import { resolvePublisherByEnrollToken, finishPasskeyEnrollment } from '~/server/utils/webauthn'

/**
 * Cross-device enrollment step 2 (token-authorized, NO session): verify + store the new device's
 * passkey, then consume the single-use token. Never issues a session — the new device logs in
 * normally (OTP + its new passkey) afterward.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ token?: string; response?: unknown; deviceName?: string }>(event)
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const resolved = await resolvePublisherByEnrollToken(token)
  if (!resolved) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'invalid_token' })
  }

  const { credentials } = await finishPasskeyEnrollment(resolved.publisherId, body?.response, body?.deviceName)

  // Single-use: consume the token so the link can't be replayed.
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const col = db.collection(config.mongodbCollectionPublishers || 'publishers')
  await col.updateOne(
    { _id: new ObjectId(resolved.publisherId) },
    { $unset: { enrollTokenKey: '', enrollTokenExpiresAt: '' } },
  )

  await logAuthEvent(event, 'passkey_enrolled', resolved.waId, { viaEnrollLink: true })
  return { success: true, credentials }
})

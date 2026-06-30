import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { logAuthEvent } from '~/server/utils/authLog'
import { verifyRegistration, listCredentials } from '~/server/utils/webauthn'

/** Finish passkey enrollment: verify the attestation against the stored challenge + store it. */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)
  const body = await readBody<{ response?: unknown; deviceName?: string }>(event)
  const response = body?.response as Parameters<typeof verifyRegistration>[0]['response']
  if (!response || typeof response !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid_input' })
  }

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const col = db.collection(config.mongodbCollectionPublishers || 'publishers')
  const credsCol = db.collection(config.mongodbCollectionWebauthnCredentials || 'webauthnCredentials')

  const now = new Date()
  const doc = await col.findOne(
    { _id: new ObjectId(session.publisherId) },
    { projection: { webauthnChallenge: 1, webauthnChallengeExpiresAt: 1 } },
  )
  if (!doc?.webauthnChallenge || !doc.webauthnChallengeExpiresAt || doc.webauthnChallengeExpiresAt <= now) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'challenge_expired' })
  }

  let verified: Awaited<ReturnType<typeof verifyRegistration>> = null
  try {
    verified = await verifyRegistration({ response, expectedChallenge: String(doc.webauthnChallenge) })
  } catch {
    verified = null
  }
  if (!verified) throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'registration_failed' })

  const deviceName = typeof body?.deviceName === 'string' && body.deviceName.trim()
    ? body.deviceName.trim().slice(0, 60)
    : 'מפתח גישה'

  try {
    await credsCol.insertOne({
      publisherId: session.publisherId,
      credentialId: verified.credentialId,
      publicKey: verified.publicKey,
      counter: verified.counter,
      transports: verified.transports || [],
      deviceName,
      createdAt: now,
      lastUsedAt: now,
    })
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      throw createError({ statusCode: 409, statusMessage: 'Conflict', message: 'already_enrolled' })
    }
    throw err
  }

  await col.updateOne(
    { _id: new ObjectId(session.publisherId) },
    { $unset: { webauthnChallenge: '', webauthnChallengeExpiresAt: '' } },
  )
  await logAuthEvent(event, 'passkey_enrolled', session.waId)

  const credentials = (await listCredentials(session.publisherId)).map((c) => ({
    id: c.credentialId, deviceName: c.deviceName || '', createdAt: c.createdAt, lastUsedAt: c.lastUsedAt,
  }))
  return { success: true, credentials }
})

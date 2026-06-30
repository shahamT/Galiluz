import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { listCredentials, buildRegistrationOptions, CHALLENGE_TTL_MS } from '~/server/utils/webauthn'

/**
 * Start passkey enrollment (any authenticated session). Returns the creation options and
 * stashes the challenge on the publisher doc for register-verify to check.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)
  const existing = await listCredentials(session.publisherId)
  const options = await buildRegistrationOptions({
    publisherId: session.publisherId,
    userName: session.fullName || session.waId,
    existing,
  })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const col = db.collection(config.mongodbCollectionPublishers || 'publishers')
  await col.updateOne(
    { _id: new ObjectId(session.publisherId) },
    { $set: { webauthnChallenge: options.challenge, webauthnChallengeExpiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) } },
  )
  return options
})

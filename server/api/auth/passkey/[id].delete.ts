import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'

/**
 * Remove one of the caller's own passkeys. If it was their last, the next staff login falls
 * back to the OTP-only grace path and forces re-enrollment (per-staffer auto-migrate).
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid_id' })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const credsCol = db.collection(config.mongodbCollectionWebauthnCredentials || 'webauthnCredentials')

  await credsCol.deleteOne({ publisherId: session.publisherId, credentialId: id })
  const remaining = await credsCol.countDocuments({ publisherId: session.publisherId })
  return { success: true, remaining }
})

import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { logAuthEvent } from '~/server/utils/authLog'

/**
 * Admin: reset a staffer's passkeys (platform_owner only — peer-staff governance). Deletes ALL
 * their enrolled credentials + any in-flight MFA/challenge state, so their next login falls back
 * to the OTP-only grace path and forces re-enrollment. The recovery path for a lost device.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requirePlatformOwner: true })
  const id = getRouterParam(event, 'id')
  if (!id || !ObjectId.isValid(id)) throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid id' })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const publishers = db.collection(config.mongodbCollectionPublishers || 'publishers')
  const credsCol = db.collection(config.mongodbCollectionWebauthnCredentials || 'webauthnCredentials')

  const target = await publishers.findOne({ _id: new ObjectId(id) }, { projection: { waId: 1 } })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'publisher not found' })

  const { deletedCount } = await credsCol.deleteMany({ publisherId: id })
  await publishers.updateOne(
    { _id: new ObjectId(id) },
    { $unset: { mfaPendingKey: '', mfaPendingExpiresAt: '', webauthnChallenge: '', webauthnChallengeExpiresAt: '' } },
  )

  await logAuthEvent(event, 'passkey_reset', String(target.waId || ''), { by: session.waId, targetPublisherId: id })
  console.info(`[admin/passkey] ${session.waId} reset passkeys for ${id} (deleted ${deletedCount})`)
  return { success: true, deleted: deletedCount }
})

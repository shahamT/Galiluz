import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { getAccountFeatures } from '~/server/utils/accountFeatures'
import { getPublisherPreferences } from '~/server/utils/publisherPreferences'
import { resolveAccountTitle, resolvePublisherRoles } from '~/server/utils/accountScope'

/**
 * Set the caller's ACTIVE business account (the `publishers.accountId` pointer that role
 * resolution reads each request). Used by the login account-picker for publishers with 2+
 * memberships. Verifies the caller is an active business member of the target account first.
 * Returns the refreshed user payload (same shape as verify-otp).
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)
  const body = await readBody<{ accountId?: string }>(event)
  const accountId = typeof body?.accountId === 'string' ? body.accountId.trim() : ''
  if (!accountId || !ObjectId.isValid(accountId)) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid_account' })
  }

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const memberships = db.collection(config.mongodbCollectionMemberships || 'memberships')
  const publishers = db.collection(config.mongodbCollectionPublishers || 'publishers')

  // Security: you can only switch INTO an account you're an active business member of.
  const membership = await memberships.findOne({
    publisherId: session.publisherId,
    accountId,
    status: 'active',
    role: { $in: ['owner', 'admin'] },
  })
  if (!membership) throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'not_a_member' })

  // Point the default-active-account at the chosen account; roles resolve from it every request.
  await publishers.updateOne({ _id: new ObjectId(session.publisherId) }, { $set: { accountId } })

  const doc = await publishers.findOne({ _id: new ObjectId(session.publisherId) })
  const roles = await resolvePublisherRoles({ publisherId: session.publisherId, accountId })
  return {
    user: {
      waId: session.waId,
      fullName: session.fullName,
      publishingAs: await resolveAccountTitle({ accountId: roles.activeAccountId, accountName: doc?.accountName, waId: session.waId }),
      platformRole: roles.platformRole,
      activeAccountId: roles.activeAccountId,
      activeRole: roles.activeRole,
      features: await getAccountFeatures({ activeAccountId: roles.activeAccountId, platformRole: roles.platformRole }),
      preferences: getPublisherPreferences(doc),
    },
  }
})

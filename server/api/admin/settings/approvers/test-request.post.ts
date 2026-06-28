import { randomInt } from 'node:crypto'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { notifyApproverOfRegistration } from '~/server/utils/notifyApprover'
import { getApprovers } from '~/server/utils/approvers'

/**
 * Admin TEST TOOL (super-admin only): create a dummy *pending* publisher and fire the real approver
 * notification, so the approver flow can be exercised end-to-end without a spare WhatsApp number.
 *
 * The dummy's waId is an obviously-invalid number (`97299…`) so the post-approve "you're approved"
 * message the bot sends to the dummy harmlessly fails — only the approver notice (to the real
 * configured approver) is genuine. Every dummy is stamped `isTestDummy:true` for cleanup.
 */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requireSuperAdmin: true })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const col = db.collection(config.mongodbCollectionPublishers || 'publishers')

  // Unique, clearly-fake waId (not a valid Israeli mobile → bot sends to it just fail).
  const waId = `97299${String(randomInt(1_000_000, 9_999_999))}`
  const now = new Date()
  const suffix = waId.slice(-4)

  await col.insertOne({
    waId,
    fullName: `בדיקת מאשרים ${suffix}`,
    email: `test+${suffix}@galiluz.test`,
    accountName: `חשבון בדיקה ${suffix}`,
    eventTypesDescription: 'בדיקה',
    status: 'pending',
    approvedTerms: true,
    approvedTermsAt: now,
    phoneVerified: true,
    registrationSource: 'web',
    isTestDummy: true,
    createdOnBehalf: false,
    createdAt: now,
    updatedAt: now,
  })

  const approvers = await getApprovers()
  // Fire the real approver notification (fire-and-forget, same as a genuine registration).
  notifyApproverOfRegistration({
    waId,
    fullName: `בדיקת מאשרים ${suffix}`,
    accountName: `חשבון בדיקה ${suffix}`,
    email: `test+${suffix}@galiluz.test`,
    eventTypesDescription: 'בדיקה',
  }).catch(() => {})

  return { success: true, dummyWaId: waId, approverCount: approvers.length }
})

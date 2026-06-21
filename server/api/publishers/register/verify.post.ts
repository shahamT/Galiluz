import { getMongoConnection } from '~/server/utils/mongodb'
import { checkAuthRateLimit, checkPhoneRateLimit } from '~/server/utils/rateLimit'
import { normaliseIsraeliPhone, verifyStoredOtp } from '~/server/utils/otp'
import { notifyApproverOfRegistration } from '~/server/utils/notifyApprover'

/**
 * Public: verify the registration OTP. Marks the pending publisher's phone verified
 * and notifies the approver. Issues NO session (the publisher logs in only after a
 * manager approves). Reuses the shared OTP verification.
 */
export default defineEventHandler(async (event) => {
  await checkAuthRateLimit(event)

  if (process.env.NODE_ENV === 'production') {
    const originHeader = getHeader(event, 'origin') ?? ''
    const host = (getHeader(event, 'host') ?? '').toLowerCase()
    let originHost = ''
    try { originHost = originHeader ? new URL(originHeader).host.toLowerCase() : '' } catch {}
    if (!originHost || originHost !== host) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'invalid_origin' })
    }
  }

  const body = await readBody<{ phone?: string; otp?: string }>(event)
  const submittedOtp = typeof body?.otp === 'string' ? body.otp.trim() : ''
  const waId = normaliseIsraeliPhone(String(body?.phone ?? ''))

  if (!waId || !/^\d{6}$/.test(submittedOtp)) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid_input' })
  }
  checkPhoneRateLimit(waId)

  const config = useRuntimeConfig()
  const { db } = await getMongoConnection()
  const col = db.collection(config.mongodbCollectionPublishers || 'publishers')

  const doc = await col.findOne({ waId })
  // Only a pending registration can be phone-verified here (login is separate).
  if (!doc || doc.status !== 'pending') {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'not_pending' })
  }

  const now = new Date()
  await verifyStoredOtp(col, waId, doc, submittedOtp, now) // throws on block/expired/invalid

  await col.updateOne(
    { waId },
    { $set: { phoneVerified: true, otpAttempts: 0 }, $unset: { otp: '', otpExpiresAt: '', otpBlockedUntil: '' } },
  )

  // Ask the wa-bot to send the approver the Approve/Reject buttons (fire-and-forget).
  notifyApproverOfRegistration({
    waId,
    fullName: doc.fullName,
    accountName: doc.accountName,
    email: doc.email,
    eventTypesDescription: doc.eventTypesDescription,
  }).catch(() => {})

  return { success: true }
})

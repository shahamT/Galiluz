import { getMongoConnection } from '~/server/utils/mongodb'
import { checkAuthRateLimit, checkPhoneRateLimit } from '~/server/utils/rateLimit'
import { normaliseIsraeliPhone } from '~/server/utils/otp'
import { classifyRegistrationPhone } from '~/server/utils/registration'

/**
 * Public: classify a phone for registration eligibility so the form can validate it
 * at the phone-entry step (and on phone change). POST keeps the phone out of query
 * logs. No DB write, no OTP, no Turnstile. Distinct from the API-secret
 * `publishers/check.get.ts` (used by the wa-bot).
 */
export default defineEventHandler(async (event) => {
  await checkAuthRateLimit(event)

  const body = await readBody<{ phone?: string }>(event)
  const waId = normaliseIsraeliPhone(typeof body?.phone === 'string' ? body.phone : '')
  if (!waId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid_phone' })
  }
  checkPhoneRateLimit(waId)

  const config = useRuntimeConfig()
  const { db } = await getMongoConnection()
  const col = db.collection(config.mongodbCollectionPublishers || 'publishers')
  const doc = await col.findOne({ waId }, { projection: { status: 1, createdOnBehalf: 1, phoneVerified: 1, deletedAt: 1 } })

  return { status: classifyRegistrationPhone(doc) }
})

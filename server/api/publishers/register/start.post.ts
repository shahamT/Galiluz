import { getMongoConnection } from '~/server/utils/mongodb'
import { checkAuthRateLimit, checkPhoneRateLimit } from '~/server/utils/rateLimit'
import { verifyTurnstileToken } from '~/server/utils/turnstile'
import { normaliseIsraeliPhone, generateAndStoreOtp, sendOtpViaGateway } from '~/server/utils/otp'
import { classifyRegistrationPhone, isValidEmail, isTwoWordName } from '~/server/utils/registration'

/**
 * Public, step-2 submit: validate all fields, upsert a `pending` publisher (carrying
 * the new `accountName` + `email`), and send a phone OTP. Issues NO session — the
 * registrant stays pending until a manager approves. Reuses the shared OTP machinery.
 */
export default defineEventHandler(async (event) => {
  await checkAuthRateLimit(event)

  // CSRF: strict origin check in production
  if (process.env.NODE_ENV === 'production') {
    const originHeader = getHeader(event, 'origin') ?? ''
    const host = (getHeader(event, 'host') ?? '').toLowerCase()
    let originHost = ''
    try { originHost = originHeader ? new URL(originHeader).host.toLowerCase() : '' } catch {}
    if (!originHost || originHost !== host) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'invalid_origin' })
    }
  }

  const body = await readBody<{
    fullName?: string; email?: string; phone?: string
    accountName?: string; eventTypesDescription?: string
    approvedTerms?: boolean; turnstileToken?: string
  }>(event)

  // Bot gate before any DB work / paid WhatsApp send
  await verifyTurnstileToken(event, body?.turnstileToken)

  const fullName = String(body?.fullName ?? '').trim()
  const email = String(body?.email ?? '').trim()
  const accountName = String(body?.accountName ?? '').trim()
  const eventTypesDescription = String(body?.eventTypesDescription ?? '').trim()
  const waId = normaliseIsraeliPhone(String(body?.phone ?? ''))

  if (!waId) throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid_phone' })
  if (!isTwoWordName(fullName)) throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid_name' })
  if (!isValidEmail(email)) throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid_email' })
  if (!accountName) throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid_account_name' })
  if (!eventTypesDescription) throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid_description' })
  if (body?.approvedTerms !== true) throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'terms_required' })

  checkPhoneRateLimit(waId)

  const config = useRuntimeConfig()
  if (!config.mongodbUri || !config.mongodbDbName) {
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
  }
  const { db } = await getMongoConnection()
  const col = db.collection(config.mongodbCollectionPublishers || 'publishers')

  const doc = await col.findOne({ waId })
  const cls = classifyRegistrationPhone(doc)
  if (cls === 'already_approved') throw createError({ statusCode: 409, statusMessage: 'Conflict', message: 'already_approved' })
  if (cls === 'pending_exists') throw createError({ statusCode: 409, statusMessage: 'Conflict', message: 'pending_exists' })
  // 'in_progress' (a web registration mid phone-verification), 'ghost_upgrade', and 'new'
  // continue: re-submitting/resending just refreshes the pending doc and resends the OTP,
  // gated by the 60s send cooldown — so completing an interrupted registration isn't a hard
  // block, while a verified registration awaiting approval (pending_exists, above) is. A
  // ghost keeps its createdOnBehalf:true (only set via $setOnInsert) so a later reject still
  // soft-ghosts it; a rejected non-ghost is hard-deleted → classified 'new'.

  const now = new Date()
  await col.updateOne(
    { waId },
    {
      $set: {
        fullName,
        email,
        accountName,
        eventTypesDescription,
        status: 'pending',
        type: 'publisher',
        approvedTerms: true,
        approvedTermsAt: now,
        phoneVerified: false,
        registrationSource: 'web',
        updatedAt: now,
      },
      $setOnInsert: { waId, createdAt: now, createdOnBehalf: false },
    },
    { upsert: true },
  )

  // The upsert doesn't touch OTP fields, so `doc` still reflects the send-cap state
  // (null for a brand-new publisher → fresh window).
  const otp = await generateAndStoreOtp(col, waId, doc, now)
  await sendOtpViaGateway(waId, otp)

  return { success: true }
})

import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { getAccountFeatures } from '~/server/utils/accountFeatures'
import { getPublisherPreferences } from '~/server/utils/publisherPreferences'
import { resolveAccountTitle } from '~/server/utils/accountScope'
import { countCredentials } from '~/server/utils/webauthn'

export default defineEventHandler(async (event) => {
  await checkRateLimit(event)
  const session = await requirePublisherAuth(event)
  // Staff with no passkey yet are in the auto-migrate grace window → the client forces
  // enrollment. (A staff session only ever exists post-OTP; with a passkey it's post-assertion.)
  const mfaEnrollRequired = session.isPlatformStaff && (await countCredentials(session.publisherId)) === 0
  return {
    waId: session.waId,
    fullName: session.fullName,
    // Account name lives on accounts.title now; keep the `publishingAs` key for the client.
    publishingAs: await resolveAccountTitle({ accountId: session.activeAccountId, accountName: session.accountName, waId: session.waId }),
    platformRole: session.platformRole,
    activeAccountId: session.activeAccountId,
    activeRole: session.activeRole,
    mfaEnrollRequired,
    // Resolved account entitlements (super-admins → all enabled). Advisory only —
    // the server independently withholds gated data; this just drives UI gating.
    features: await getAccountFeatures(session),
    // Resolved per-publisher preferences (merged over registry defaults).
    preferences: getPublisherPreferences(session),
  }
})

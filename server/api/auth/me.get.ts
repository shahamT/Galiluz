import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { getAccountFeatures } from '~/server/utils/accountFeatures'
import { getPublisherPreferences } from '~/server/utils/publisherPreferences'
import { resolveAccountTitle } from '~/server/utils/accountScope'

export default defineEventHandler(async (event) => {
  await checkRateLimit(event)
  const session = await requirePublisherAuth(event)
  return {
    waId: session.waId,
    fullName: session.fullName,
    // Account name lives on accounts.title now; keep the `publishingAs` key for the client.
    publishingAs: await resolveAccountTitle({ accountId: session.accountId, accountName: session.accountName, waId: session.waId }),
    type: session.type,
    platformRole: session.platformRole,
    activeAccountId: session.activeAccountId,
    activeRole: session.activeRole,
    // Resolved account entitlements (super-admins → all enabled). Advisory only —
    // the server independently withholds gated data; this just drives UI gating.
    features: await getAccountFeatures(session),
    // Resolved per-publisher preferences (merged over registry defaults).
    preferences: getPublisherPreferences(session),
  }
})

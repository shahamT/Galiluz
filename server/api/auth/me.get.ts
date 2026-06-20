import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { getAccountFeatures } from '~/server/utils/accountFeatures'
import { getPublisherPreferences } from '~/server/utils/publisherPreferences'

export default defineEventHandler(async (event) => {
  await checkRateLimit(event)
  const session = await requirePublisherAuth(event)
  return {
    waId: session.waId,
    fullName: session.fullName,
    publishingAs: session.publishingAs,
    type: session.type,
    // Resolved account entitlements (managers → all enabled). Advisory only —
    // the server independently withholds gated data; this just drives UI gating.
    features: await getAccountFeatures(session),
    // Resolved per-publisher preferences (merged over registry defaults).
    preferences: getPublisherPreferences(session),
  }
})

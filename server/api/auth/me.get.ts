import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { checkRateLimit } from '~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  await checkRateLimit(event)
  const session = await requirePublisherAuth(event)
  return {
    waId: session.waId,
    fullName: session.fullName,
    publishingAs: session.publishingAs,
    type: session.type,
  }
})

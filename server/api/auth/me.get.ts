import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'

export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)
  return {
    waId: session.waId,
    fullName: session.fullName,
    publishingAs: session.publishingAs,
    type: session.type,
  }
})

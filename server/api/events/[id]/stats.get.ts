import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'

// Internal-only: no client or app currently consumes this publicly, and per-event
// analytics must not be open to enumeration.
export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id required' })

  const config = useRuntimeConfig()
  const { db } = await getMongoConnection()
  const statsCol = db.collection((config as Record<string, string>).mongodbCollectionEventStats || 'eventStats')

  const doc = await statsCol.findOne({ eventId: id, deletedAt: { $exists: false } }, {
    projection: { _id: 0, eventId: 0, publisherId: 0, lastInteractionAt: 0 },
  })

  return doc ?? { views: 0, uniqueViews: 0, shares: 0, navClicks: 0, calendarAdds: 0, linkClicks: 0, contactClicks: 0 }
})

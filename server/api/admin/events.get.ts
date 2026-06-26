import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { NOT_DELETED } from '~/server/utils/eventsQuery'

/**
 * Admin (manager-only) events list: EVERY non-deleted event on the platform,
 * regardless of publisher/account (incl. ghost-publisher events). Same response
 * shape as /api/publisher/events so the publisher list UI renders it unchanged.
 */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requirePlatformStaff: true })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()

  const eventsCol = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')

  // No publisher scope — all events. event:{ $ne: null } excludes draft-only/empty docs.
  const docs = await eventsCol
    .find({ ...NOT_DELETED, event: { $ne: null } })
    .project({
      _id: 1,
      isActive: 1,
      'event.Title': 1,
      'event.occurrences': 1,
      'event.price': 1,
      'event.mainCategory': 1,
      'event.publisherId': 1,
    })
    .toArray()

  // Sort by latest occurrence date descending
  docs.sort((a, b) => {
    const latestA = [...(a.event?.occurrences || [])].sort((x, y) => y.date.localeCompare(x.date))[0]?.date || ''
    const latestB = [...(b.event?.occurrences || [])].sort((x, y) => y.date.localeCompare(x.date))[0]?.date || ''
    return latestB.localeCompare(latestA)
  })

  return docs.map(doc => ({
    id: doc._id.toString(),
    title: doc.event?.Title || '',
    occurrences: (doc.event?.occurrences || []).map((o: Record<string, unknown>) => ({
      date: o.date,
      hasTime: o.hasTime,
      startTime: o.startTime,
      endTime: o.endTime ?? null,
    })),
    price: doc.event?.price ?? null,
    isActive: doc.isActive ?? false,
    mainCategory: doc.event?.mainCategory || '',
    publisherId: doc.event?.publisherId || '',
  }))
})

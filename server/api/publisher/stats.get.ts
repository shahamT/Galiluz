import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)

  const config = useRuntimeConfig()
  const { db } = await getMongoConnection()

  const statsCol = db.collection((config as Record<string, string>).mongodbCollectionEventStats || 'eventStats')
  const eventsCol = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')

  // Get all stats for this publisher
  const publisherQuery = session.type === 'manager' ? {} : { publisherId: session.publisherId }
  const stats = await statsCol.find(publisherQuery, {
    sort: { views: -1 },
    limit: 100,
  }).toArray()

  if (stats.length === 0) return []

  // Enrich with event titles
  const eventIds = stats.map((s) => { try { return new ObjectId(s.eventId) } catch { return null } }).filter(Boolean)
  const events = await eventsCol.find(
    { _id: { $in: eventIds } },
    { projection: { 'event.Title': 1, 'event.occurrences': 1 } },
  ).toArray()

  const eventMap = new Map(events.map((e) => [e._id.toString(), e]))

  return stats.map((s) => {
    const doc = eventMap.get(s.eventId)
    return {
      eventId: s.eventId,
      title: doc?.event?.Title || '',
      views: s.views || 0,
      uniqueViews: s.uniqueViews || 0,
      shares: s.shares || 0,
      navClicks: s.navClicks || 0,
      calendarAdds: s.calendarAdds || 0,
      linkClicks: s.linkClicks || 0,
      contactClicks: s.contactClicks || 0,
      lastInteractionAt: s.lastInteractionAt || null,
    }
  })
})

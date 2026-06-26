import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { getAccountPublisherIds } from '~/server/utils/accountScope'
import { getAccountFeatures } from '~/server/utils/accountFeatures'
import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)

  // Entitlement: this is account-wide statistics — withhold entirely when the
  // account lacks `globalStats` (managers bypass).
  if (!(await getAccountFeatures(session)).globalStats) return []

  const config = useRuntimeConfig()
  const { db } = await getMongoConnection()

  const statsCol = db.collection((config as Record<string, string>).mongodbCollectionEventStats || 'eventStats')
  const eventsCol = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')

  // Account-scoped (excluding stats of soft-deleted events). Managers see all.
  const publisherQuery = {
    ...(session.isSuperAdmin ? {} : { publisherId: { $in: await getAccountPublisherIds(session) } }),
    deletedAt: { $exists: false },
  }
  const stats = await statsCol.find(publisherQuery, {
    sort: { views: -1 },
    limit: 100,
  }).toArray()

  if (stats.length === 0) return []

  // Enrich with event titles
  const eventIds = stats.map((s) => { try { return new ObjectId(s.eventId) } catch { return null } }).filter(Boolean)
  const events = await eventsCol.find(
    { _id: { $in: eventIds }, deletedAt: { $exists: false } },
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

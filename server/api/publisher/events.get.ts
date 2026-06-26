import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { NOT_DELETED } from '~/server/utils/eventsQuery'
import { getAccountEventFilter } from '~/server/utils/accountScope'

export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()

  const eventsCol = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')

  // Tenant-scoped: events owned by the caller's active account (event.accountId), with a
  // straggler fallback to the account's publisher-set for any not-yet-stamped event.
  const scope = await getAccountEventFilter(session)
  const docs = await eventsCol
    .find({ ...scope, ...NOT_DELETED })
    .project({
      _id: 1,
      isActive: 1,
      'event.Title': 1,
      'event.occurrences': 1,
      'event.price': 1,
      'event.mainCategory': 1,
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
  }))
})

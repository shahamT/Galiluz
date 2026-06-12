import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { getAccountPublisherIds } from '~/server/utils/accountScope'

export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id required' })

  let objectId: ObjectId
  try { objectId = new ObjectId(id) } catch {
    throw createError({ statusCode: 400, message: 'invalid id' })
  }

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()

  const eventsCol      = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')
  const statsCol       = db.collection(config.mongodbCollectionEventStats || 'eventStats')
  const occStatsCol    = db.collection(config.mongodbCollectionEventOccurrenceStats || 'eventOccurrenceStats')
  const interactionsCol = db.collection(config.mongodbCollectionEventInteractions || 'eventInteractions')

  const doc = await eventsCol.findOne({ _id: objectId })
  if (!doc || doc.deletedAt) throw createError({ statusCode: 404, message: 'event not found' })

  // Account-scoped ownership: any publisher in the caller's account owns the event (1:1 today).
  const ownsEvent = (await getAccountPublisherIds(session)).includes(doc.event?.publisherId)
  if (session.type !== 'manager' && !ownsEvent) {
    throw createError({ statusCode: 403, message: 'forbidden' })
  }

  const [eventStats, occurrenceStats, linkGroups] = await Promise.all([
    statsCol.findOne({ eventId: id }),
    occStatsCol.find({ eventId: id }).toArray(),
    interactionsCol.aggregate([
      { $match: { eventId: id, action: 'link' } },
      { $group: { _id: '$linkTitle', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),
  ])

  const totalViews      = occurrenceStats.reduce((s: number, o: any) => s + (o.views || 0), 0)
  const totalUniqueViews = occurrenceStats.reduce((s: number, o: any) => s + (o.uniqueViews || 0), 0)
  const totalCalendarAdds = occurrenceStats.reduce((s: number, o: any) => s + (o.calendarAdds || 0), 0)

  return {
    id,
    title:            doc.event?.Title || '',
    isActive:         doc.isActive ?? false,
    multiDayEvent:    doc.event?.multiDayEvent !== false,
    shortDescription: doc.event?.shortDescription || '',
    fullDescription:  doc.event?.fullDescription || '',
    mainCategory:     doc.event?.mainCategory || '',
    categories:       doc.event?.categories || [],
    location: {
      city:          doc.event?.location?.city || '',
      cityType:      doc.event?.location?.cityType || undefined,
      region:        doc.event?.location?.region || '',
      locationName:  doc.event?.location?.locationName || '',
      addressLine1:  doc.event?.location?.addressLine1 || '',
      locationNotes: doc.event?.location?.locationDetails || doc.event?.location?.locationNotes || '',
      wazeNavLink:   doc.event?.location?.wazeNavLink || null,
      gmapsNavLink:  doc.event?.location?.gmapsNavLink || null,
    },
    occurrences: (doc.event?.occurrences || []).map((o: any) => ({
      date:      o.date,
      hasTime:   o.hasTime,
      startTime: o.startTime || null,
      endTime:   o.endTime || null,
    })),
    price: doc.event?.price ?? null,
    urls:  (doc.event?.urls || []).map((u: any) => ({ Title: u.Title, Url: u.Url, type: u.type })),
    media: (doc.event?.media || []).map((m: any) => ({
      cloudinaryURL: m.cloudinaryURL || m.url || '',
      cloudinaryData: m.cloudinaryData || {},
      isMain: m.isMain || false,
    })),
    stats: {
      shares:        eventStats?.shares || 0,
      navClicks:     eventStats?.navClicks || 0,
      calendarAdds:  totalCalendarAdds,
      contactClicks: eventStats?.contactClicks || 0,
      linkClicks:    eventStats?.linkClicks || 0,
      linkBreakdown: linkGroups.map((l: any) => ({ title: l._id || 'קישור', clicks: l.count })),
      occurrenceStats: occurrenceStats
        .sort((a: any, b: any) => a.occurrenceDate.localeCompare(b.occurrenceDate))
        .map((o: any) => ({
          date:        o.occurrenceDate,
          views:       o.views || 0,
          uniqueViews: o.uniqueViews || 0,
          calendarAdds: o.calendarAdds || 0,
        })),
      totalViews,
      totalUniqueViews,
    },
  }
})

import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { getAccountPublisherIds } from '~/server/utils/accountScope'
import { getTodayIsrael } from '~/server/utils/eventFirstOccurrence'

const PUBLISHER_LOG_ACTIONS = ['event_created', 'event_activated', 'event_deactivated', 'event_edited', 'event_deleted']

function formatDate(d: string) {
  // YYYY-MM-DD → D.M
  if (!d) return ''
  const [, m, day] = d.split('-')
  return `${parseInt(day)}.${parseInt(m)}`
}

export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)

  const q = getQuery(event)
  const filter = ['all', 'active', 'month'].includes(q.filter as string) ? (q.filter as string) : 'all'

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()

  const eventsCol = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')
  const occStatsCol = db.collection(config.mongodbCollectionEventOccurrenceStats || 'eventOccurrenceStats')
  const statsCol = db.collection(config.mongodbCollectionEventStats || 'eventStats')
  const interactionsCol = db.collection(config.mongodbCollectionEventInteractions || 'eventInteractions')
  const logsCol = db.collection(config.mongodbCollectionEventLogs || 'eventLogs')

  // Account-scoped: resolve the caller's account → its publisherIds (1:1 today).
  const accountPublisherIds = await getAccountPublisherIds(session)

  // Stats filters always exclude soft-deleted events' data (stamped with deletedAt on delete)
  const pubFilter = {
    ...(session.type === 'manager' ? {} : { publisherId: { $in: accountPublisherIds } }),
    deletedAt: { $exists: false },
  }
  const today = getTodayIsrael()
  const [yr, mo] = today.split('-')
  const monthPrefix = `${yr}-${mo}`

  // ── 1. Event counts (always all-time, no filter) ──────────────────────────
  const allEvents = await eventsCol.find(
    { 'event.publisherId': { $in: accountPublisherIds }, deletedAt: { $exists: false }, event: { $ne: null } },
    { projection: { 'event.occurrences': 1, 'event.Title': 1, 'event.multiDayEvent': 1, isActive: 1, _id: 1 } },
  ).toArray()

  const activeEvents = allEvents.filter((e) => e.isActive === true)
  const draftsCount = allEvents.length - activeEvents.length

  const futureEventIds = new Set<string>()
  activeEvents.forEach((e) => {
    const hasFuture = (e.event?.occurrences || []).some((occ: any) => (occ.date || '') >= today)
    if (hasFuture) futureEventIds.add(e._id.toString())
  })

  const eventCounts = {
    total: activeEvents.length,
    future: futureEventIds.size,
    past: activeEvents.length - futureEventIds.size,
    drafts: draftsCount,
  }

  // ── 2. Determine date scope for filtered stats ────────────────────────────
  let occDateFilter: Record<string, unknown> = {}
  if (filter === 'active') occDateFilter = { occurrenceDate: { $gte: today } }
  else if (filter === 'month') occDateFilter = { occurrenceDate: { $regex: `^${monthPrefix}` } }

  // ── 3. Occurrence-level totals (views, uniqueViews, calendarAdds) ─────────
  const [occTotals] = await occStatsCol.aggregate([
    { $match: { ...pubFilter, ...occDateFilter } },
    { $group: { _id: null, views: { $sum: '$views' }, uniqueViews: { $sum: '$uniqueViews' }, calendarAdds: { $sum: '$calendarAdds' } } },
  ]).toArray()

  // ── 4. Event-level totals (shares, nav, links, contact) ───────────────────
  let eventLevelTotals = { shares: 0, navClicks: 0, linkClicks: 0, contactClicks: 0 }

  if (filter === 'month') {
    const monthStart = new Date(`${monthPrefix}-01T00:00:00.000Z`)
    const nextMo = parseInt(mo) === 12 ? `${parseInt(yr) + 1}-01` : `${yr}-${String(parseInt(mo) + 1).padStart(2, '0')}`
    const monthEnd = new Date(`${nextMo}-01T00:00:00.000Z`)
    const groups = await interactionsCol.aggregate([
      { $match: { ...pubFilter, action: { $in: ['share', 'nav', 'link', 'contact'] }, timestamp: { $gte: monthStart, $lt: monthEnd } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
    ]).toArray()
    groups.forEach((g: any) => {
      if (g._id === 'share') eventLevelTotals.shares = g.count
      else if (g._id === 'nav') eventLevelTotals.navClicks = g.count
      else if (g._id === 'link') eventLevelTotals.linkClicks = g.count
      else if (g._id === 'contact') eventLevelTotals.contactClicks = g.count
    })
  } else {
    const statsMatchFilter = filter === 'active'
      ? { ...pubFilter, eventId: { $in: Array.from(futureEventIds) } }
      : pubFilter
    const [sr] = await statsCol.aggregate([
      { $match: statsMatchFilter },
      { $group: { _id: null, shares: { $sum: '$shares' }, navClicks: { $sum: '$navClicks' }, linkClicks: { $sum: '$linkClicks' }, contactClicks: { $sum: '$contactClicks' } } },
    ]).toArray()
    if (sr) eventLevelTotals = { shares: sr.shares || 0, navClicks: sr.navClicks || 0, linkClicks: sr.linkClicks || 0, contactClicks: sr.contactClicks || 0 }
  }

  const totals = {
    views: occTotals?.views || 0,
    uniqueViews: occTotals?.uniqueViews || 0,
    calendarAdds: occTotals?.calendarAdds || 0,
    ...eventLevelTotals,
  }

  const activeEventsCount = futureEventIds.size

  // ── 5. Top events ─────────────────────────────────────────────────────────
  const topOccRows = await occStatsCol.find({ ...pubFilter, ...occDateFilter }, { sort: { views: -1 }, limit: 20 }).toArray()

  // Build a lookup of event metadata
  const eventIdSet = [...new Set(topOccRows.map((r: any) => r.eventId))]
  const eventMeta: Record<string, { title: string; multiDayEvent: boolean }> = {}
  allEvents.forEach((e) => {
    const id = e._id.toString()
    if (eventIdSet.includes(id)) {
      eventMeta[id] = {
        title: e.event?.Title || '',
        multiDayEvent: e.event?.multiDayEvent !== false,
      }
    }
  })

  // Group or keep separate based on multiDayEvent
  const topEventsMap = new Map<string, any>()
  topOccRows.forEach((row: any) => {
    const meta = eventMeta[row.eventId] || { title: '', multiDayEvent: true }
    if (meta.multiDayEvent) {
      // Group all occurrences under the eventId
      const existing = topEventsMap.get(row.eventId)
      if (existing) {
        existing.views += row.views || 0
        existing.uniqueViews += row.uniqueViews || 0
        if (row.occurrenceDate < existing.startDate) existing.startDate = row.occurrenceDate
        if (row.occurrenceDate > existing.endDate) existing.endDate = row.occurrenceDate
        existing.occurrenceDates.push(row.occurrenceDate)
      } else {
        topEventsMap.set(row.eventId, {
          eventId: row.eventId,
          title: meta.title,
          multiDayEvent: true,
          views: row.views || 0,
          uniqueViews: row.uniqueViews || 0,
          startDate: row.occurrenceDate,
          endDate: row.occurrenceDate,
          occurrenceDates: [row.occurrenceDate],
        })
      }
    } else {
      // Keep each occurrence as a separate row
      const key = `${row.eventId}::${row.occurrenceDate}`
      topEventsMap.set(key, {
        eventId: row.eventId,
        title: meta.title,
        multiDayEvent: false,
        views: row.views || 0,
        uniqueViews: row.uniqueViews || 0,
        occurrenceDate: row.occurrenceDate,
        startDate: null,
        endDate: null,
      })
    }
  })

  const topEvents = Array.from(topEventsMap.values())
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)
    .map((e) => {
      if (e.multiDayEvent) {
        const isSingle = e.occurrenceDates.length === 1
        return {
          eventId: e.eventId,
          title: e.title,
          multiDayEvent: true,
          views: e.views,
          uniqueViews: e.uniqueViews,
          occurrenceDate: isSingle ? formatDate(e.startDate) : null,
          startDate: isSingle ? null : formatDate(e.startDate),
          endDate: isSingle ? null : formatDate(e.endDate),
        }
      }
      return {
        eventId: e.eventId,
        title: e.title,
        multiDayEvent: false,
        views: e.views,
        uniqueViews: e.uniqueViews,
        occurrenceDate: formatDate(e.occurrenceDate),
        startDate: null,
        endDate: null,
      }
    })

  // ── 6. Recent logs ────────────────────────────────────────────────────────
  const rawLogs = await logsCol.find(
    { publisherId: { $in: accountPublisherIds }, action: { $in: PUBLISHER_LOG_ACTIONS } },
    { sort: { createdAt: -1 }, limit: 6, projection: { action: 1, title: 1, rawTitle: 1, createdAt: 1 } },
  ).toArray()

  const recentLogs = rawLogs.map((l: any) => ({
    action: l.action,
    title: l.title || l.rawTitle || '',
    createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : (l.createdAt || ''),
  }))

  return { eventCounts, totals, activeEventsCount, topEvents, recentLogs }
})

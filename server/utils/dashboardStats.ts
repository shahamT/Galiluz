import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { getTodayIsrael } from '~/server/utils/eventFirstOccurrence'

const PUBLISHER_LOG_ACTIONS = ['event_created', 'event_activated', 'event_deactivated', 'event_edited', 'event_deleted']

// Dev-only diagnostic logging — stripped from the production build via `import.meta.dev`.
const DASH_LOG = '[Dashboard][DEV]'
function devLog(message: string, data?: unknown) {
  if (import.meta.dev) console.info(DASH_LOG, message, data !== undefined ? JSON.stringify(data) : '')
}

function formatDate(d: string) {
  // YYYY-MM-DD → D.M
  if (!d) return ''
  const [, m, day] = d.split('-')
  return `${parseInt(day)}.${parseInt(m)}`
}

export interface DashboardScope {
  /** Publisher scope for the stats collections (occStats / interactions / eventStats).
   *  `{}` = platform-wide; `{ publisherId: { $in: ids } }` = scoped. Merged with deletedAt-absent. */
  statsPubFilter: Record<string, unknown>
  /** Scope for the events collection (used for counts + top-event metadata).
   *  `{}` = all events (incl. ghost-publisher events, admin dashboard); `{ 'event.accountId': id }` =
   *  scoped to one account (publisher dashboard, via getAccountEventFilter). */
  eventsPubFilter: Record<string, unknown>
  /** Filter for the recent-activity logs (who performed the action), e.g.
   *  `{ publisherId: x }` (a single actor) or `{ publisherId: { $in: ids } }`. */
  logsPubFilter: Record<string, unknown>
  /** 'all' | 'active' | 'month' — date scope for the filtered stats. */
  filter: string
  /** The viewer's own publisherId — the actor name is OMITTED on their own log rows
   *  (so the account feed only names OTHER publishers' actions). */
  selfPublisherId?: string
  /** Account entitlement `globalStats`. When false, `totals` is null and top-event
   *  rows omit view/visitor numbers (ranking is preserved). Gated by the caller. */
  includeStats: boolean
  /** When true, scope the KPI stats collections to the account's OWN events (by `event.accountId`,
   *  derived from `eventsPubFilter`) instead of by the member-publisher set that `statsPubFilter`
   *  carries. Prevents a publisher who belongs to more than one account from leaking their other
   *  account's views/interactions into this dashboard's totals. Equivalent to publisherId-scoping
   *  for the common one-publisher-per-account case. The activity feed (`logsPubFilter`) is NOT
   *  affected. Left off for the admin (platform-wide) dashboard. */
  scopeStatsToAccountEvents?: boolean
}

/**
 * Computes the dashboard payload — event counts, totals, active count, top events, and
 * recent activity — for a given scope. Shared by the publisher dashboard (account-scoped)
 * and the admin dashboard (platform-wide). The three `*PubFilter` args are the only
 * scoping inputs; the date/deletedAt logic and aggregation shape are identical for both.
 */
export async function computeDashboard(scope: DashboardScope) {
  const { statsPubFilter, eventsPubFilter, logsPubFilter, filter, includeStats, selfPublisherId, scopeStatsToAccountEvents } = scope

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()

  const eventsCol = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')
  const occStatsCol = db.collection(config.mongodbCollectionEventOccurrenceStats || 'eventOccurrenceStats')
  const statsCol = db.collection(config.mongodbCollectionEventStats || 'eventStats')
  const interactionsCol = db.collection(config.mongodbCollectionEventInteractions || 'eventInteractions')
  const logsCol = db.collection(config.mongodbCollectionEventLogs || 'eventLogs')

  // Account-scoped dashboards scope the KPI STATS by the account's OWN events (the `event.accountId`
  // tenant key, matching how event counts already scope), NOT by the member-publisher set:
  // publisherId-scoping over-counts when a publisher belongs to more than one account (a merged/
  // multi-account publisher would otherwise leak their OTHER account's views/interactions here).
  // For the common one-publisher-per-account case this is a no-op. All non-deleted published events
  // carry an accountId, so the id set is complete; deleted events' stats are dropped by the
  // `deletedAt` guard below anyway.
  //
  // The activity FEED (`logsPubFilter`) is deliberately left publisherId-scoped: event-scoping it
  // would hide `event_deleted` entries for legacy events whose (now-deleted) doc has no accountId,
  // dropping real deletion history from the feed. The feed's only residual cross-account bleed is a
  // dual-account member's name in the last-6 list — cosmetic, and not worth that regression.
  let statsScope = statsPubFilter
  if (scopeStatsToAccountEvents) {
    const scopedIds = (await eventsCol
      .find({ ...eventsPubFilter }, { projection: { _id: 1 } })
      .toArray()).map((e) => e._id.toString())
    statsScope = { eventId: { $in: scopedIds } }
  }

  // Stats filters always exclude soft-deleted events' data (stamped with deletedAt on delete)
  const pubFilter = {
    ...statsScope,
    deletedAt: { $exists: false },
  }
  devLog('computeDashboard scope', { statsPubFilter, eventsPubFilter, logsPubFilter, scopeStatsToAccountEvents, filter, pubFilter })
  const today = getTodayIsrael()
  const [yr, mo] = today.split('-')
  const monthPrefix = `${yr}-${mo}`

  // ── 1. Event counts (always all-time, no filter) ──────────────────────────
  const allEvents = await eventsCol.find(
    { ...eventsPubFilter, deletedAt: { $exists: false }, event: { $ne: null } },
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

  // ── 3 & 4. Aggregate totals (KPIs) — only when the account has `globalStats`. ──
  // When the entitlement is off, the totals queries are skipped entirely (the
  // protected numbers never leave the server) and `totals` stays null.
  let totals: Record<string, number> | null = null
  if (includeStats) {
    // ── 3. Occurrence-level totals (views, uniqueViews, calendarAdds) ─────────
    if (import.meta.dev) {
      const occTotalDocs = await occStatsCol.countDocuments({})
      const occMatchedDocs = await occStatsCol.countDocuments({ ...pubFilter, ...occDateFilter })
      const statsTotalDocs = await statsCol.countDocuments({})
      const statsMatchedDocs = await statsCol.countDocuments(pubFilter)
      devLog('collection doc counts', {
        eventOccurrenceStats: { total: occTotalDocs, matchedByFilter: occMatchedDocs },
        eventStats: { total: statsTotalDocs, matchedByFilter: statsMatchedDocs },
        occDateFilter,
      })
    }

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

    totals = {
      views: occTotals?.views || 0,
      uniqueViews: occTotals?.uniqueViews || 0,
      calendarAdds: occTotals?.calendarAdds || 0,
      ...eventLevelTotals,
    }
    devLog('computed totals', { eventCounts, totals, activeEventsCount: futureEventIds.size })
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
    { ...logsPubFilter, action: { $in: PUBLISHER_LOG_ACTIONS } },
    { sort: { createdAt: -1 }, limit: 6, projection: { action: 1, title: 1, rawTitle: 1, createdAt: 1, publisherId: 1 } },
  ).toArray()

  // Resolve actor names for rows performed by OTHER publishers in the scope, so the account
  // feed names who did what (the viewer's own rows stay nameless — handled in the map below).
  const otherPubIds = [...new Set(
    rawLogs.map((l: any) => (l.publisherId ? String(l.publisherId) : '')).filter((id: string) => id && id !== selfPublisherId),
  )]
  const nameById: Record<string, string> = {}
  if (otherPubIds.length) {
    const pubsCol = db.collection(config.mongodbCollectionPublishers || 'publishers')
    const objIds = otherPubIds.map((id) => { try { return new ObjectId(id) } catch { return null } }).filter(Boolean) as ObjectId[]
    const pubs = await pubsCol.find({ _id: { $in: objIds } }, { projection: { fullName: 1 } }).toArray()
    for (const p of pubs) nameById[p._id.toString()] = (p.fullName as string) || ''
  }

  const recentLogs = rawLogs.map((l: any) => {
    const pid = l.publisherId ? String(l.publisherId) : ''
    return {
      action: l.action,
      title: l.title || l.rawTitle || '',
      createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : (l.createdAt || ''),
      // Name of the acting publisher — only when it's NOT the viewer (so the feed can show
      // "<name> created …" for account-mates, and second-person phrasing for the viewer).
      publisherName: pid && pid !== selfPublisherId ? (nameById[pid] || '') : '',
    }
  })

  // When `globalStats` is off, keep the ranking (title + date) but withhold the
  // view/visitor numbers — they must not reach the browser.
  const topEventsOut = includeStats
    ? topEvents
    : topEvents.map(({ views, uniqueViews, ...rest }) => rest)

  return { eventCounts, totals, activeEventsCount, topEvents: topEventsOut, recentLogs }
}

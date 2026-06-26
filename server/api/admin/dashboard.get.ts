import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { computeDashboard } from '~/server/utils/dashboardStats'

/**
 * Admin (manager-only) dashboard: platform-wide stats across ALL accounts and
 * publishers — including ghost-publisher events (no publisher filter on events
 * or stats). The activity log is scoped to the admin's OWN actions, since a
 * manager acts across the whole platform.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requirePlatformStaff: true })

  const q = getQuery(event)
  const filter = ['all', 'active', 'month'].includes(q.filter as string) ? (q.filter as string) : 'all'

  return computeDashboard({
    statsPubFilter: {},                                  // all publishers' stats
    eventsPubFilter: {},                                 // all events, incl. ghost-publisher events
    logsPubFilter: { publisherId: session.publisherId }, // the admin's own actions
    filter,
    includeStats: true,                                  // admin portal always sees full stats — never gated by `features`
  })
})

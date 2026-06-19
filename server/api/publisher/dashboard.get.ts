import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { getAccountPublisherIds } from '~/server/utils/accountScope'
import { getAccountFeatures } from '~/server/utils/accountFeatures'
import { computeDashboard } from '~/server/utils/dashboardStats'

export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)

  const q = getQuery(event)
  const filter = ['all', 'active', 'month'].includes(q.filter as string) ? (q.filter as string) : 'all'

  // Account-scoped: resolve the caller's account → its publisherIds (1:1 today).
  // Managers keep their existing cross-publisher stats totals; counts + activity
  // stay scoped to the caller's account.
  const accountPublisherIds = await getAccountPublisherIds(session)

  // Entitlement: KPI totals + top-event numbers are returned only when the
  // account has `globalStats` (managers bypass). When off, computeDashboard
  // omits the totals and strips the top-event numbers server-side.
  const features = await getAccountFeatures(session)

  return computeDashboard({
    statsPubFilter: session.type === 'manager' ? {} : { publisherId: { $in: accountPublisherIds } },
    eventsPubFilter: { 'event.publisherId': { $in: accountPublisherIds } },
    logsPubFilter: { publisherId: { $in: accountPublisherIds } },
    filter,
    includeStats: features.globalStats,
  })
})

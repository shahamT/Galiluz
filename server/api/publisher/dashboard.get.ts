import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { getAccountPublisherIds, getAccountEventFilter } from '~/server/utils/accountScope'
import { getAccountFeatures } from '~/server/utils/accountFeatures'
import { computeDashboard } from '~/server/utils/dashboardStats'

export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)

  const q = getQuery(event)
  const filter = ['all', 'active', 'month'].includes(q.filter as string) ? (q.filter as string) : 'all'

  // Stats/logs are keyed by publisherId → scope by the account's publisher-set. Super-admins keep
  // their cross-publisher stats totals; event counts + activity stay scoped to the active account.
  const accountPublisherIds = await getAccountPublisherIds(session)

  // Entitlement: KPI totals + top-event numbers are returned only when the
  // account has `globalStats` (super-admins bypass). When off, computeDashboard
  // omits the totals and strips the top-event numbers server-side.
  const features = await getAccountFeatures(session)

  return computeDashboard({
    statsPubFilter: session.isSuperAdmin ? {} : { publisherId: { $in: accountPublisherIds } },
    // Event counts scope by the tenant key (same as the portal events list) — not the publisher-set.
    eventsPubFilter: getAccountEventFilter(session),
    logsPubFilter: { publisherId: { $in: accountPublisherIds } },
    filter,
    includeStats: features.globalStats,
  })
})

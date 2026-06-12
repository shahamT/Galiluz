import { getMongoConnection } from '~/server/utils/mongodb'
import { ensureAccountForPublisher } from '~/server/utils/accountScope'

/**
 * ONE-TIME production migration — DELETE this plugin after the deploy confirms it ran
 * (see docs/PRODUCTION_OPS.md). Backfills an account for every publisher that is missing
 * `accountId`, so existing publishers join the new accounts structure.
 *
 * Idempotent: publishers that already have an `accountId` are skipped, so restarts and
 * re-deploys are safe no-ops. Fire-and-forget with one delayed retry (covers Atlas SRV
 * cold-start timeouts), mirroring ensure-indexes. Reuses the same ensureAccountForPublisher
 * helper the approval flow uses, so creation logic stays in one place.
 */
export default defineNitroPlugin(() => {
  withRetry(runBackfill)
})

function withRetry(fn: () => Promise<void>, retryDelayMs = 10_000) {
  fn().catch((err) => {
    console.error(`[BackfillAccounts] first attempt failed, retrying in ${retryDelayMs / 1000}s:`, err instanceof Error ? err.message : err)
    setTimeout(() => {
      fn().catch((err2) => console.error('[BackfillAccounts] retry failed:', err2 instanceof Error ? err2.message : err2))
    }, retryDelayMs)
  })
}

async function runBackfill() {
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const publishers = db.collection(config.mongodbCollectionPublishers || 'publishers')

  const pending = await publishers
    .find({ $or: [{ accountId: { $exists: false } }, { accountId: null }, { accountId: '' }] })
    .project({ _id: 1, publishingAs: 1, waId: 1 })
    .toArray()

  if (pending.length === 0) {
    console.info('[BackfillAccounts] all publishers already linked to an account — nothing to do')
    return
  }

  let created = 0
  for (const pub of pending) {
    await ensureAccountForPublisher(pub as Parameters<typeof ensureAccountForPublisher>[0])
    created++
  }
  console.info(`[BackfillAccounts] backfilled accounts for ${created}/${pending.length} publisher(s)`)
}

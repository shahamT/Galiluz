import { randomBytes } from 'node:crypto'
import { getMongoConnection } from '~/server/utils/mongodb'
import { logEventDeletion } from '~/server/utils/eventLogs.service'
import { softDeleteEventStatsData } from '~/server/utils/eventStats.service'
import { deleteEventCloudinaryMedia } from '~/server/utils/eventMedia.service'

const UNPUBLISHED_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 1 week
const SWEEP_THROTTLE_MS = 60 * 60 * 1000 // run at most hourly

let lastSweepAt = 0

/**
 * Silently soft-delete *untouched* crawler auto-drafts a week after creation (clutter
 * cleanup). Targets `createdByCrawler: true` events that are still a draft
 * (`isActive: false`), older than the TTL, not already deleted, AND that the publisher
 * never acted on — `updatedAt` absent. `updatedAt` is stamped by edit / publish /
 * unpublish / transfer, so a draft the publisher modified or published-then-unpublished
 * is KEPT. Published events are left alone. Soft-delete only — events are never
 * hard-deleted (DATA_MODEL invariant): reuses the same sequence as the publisher delete
 * route (log → deletedAt + isActive false → stamp stats → destroy media). Best-effort:
 * never throws. Returns the count.
 */
export async function sweepExpiredCrawlerDrafts(): Promise<number> {
  try {
    const config = useRuntimeConfig() as Record<string, string>
    const { db } = await getMongoConnection()
    const eventsCol = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')
    const cutoff = new Date(Date.now() - UNPUBLISHED_TTL_MS)

    const stale = await eventsCol
      .find({
        createdByCrawler: true,
        isActive: false,
        deletedAt: { $exists: false },
        updatedAt: { $exists: false }, // never touched by the publisher
        createdAt: { $lt: cutoff },
      })
      .toArray()
    if (!stale.length) return 0

    let deleted = 0
    for (const doc of stale) {
      const id = doc._id.toString()
      try {
        const ev = doc.event as Record<string, unknown> | undefined
        const rawEv = doc.rawEvent as Record<string, unknown> | undefined
        const correlationId = randomBytes(4).toString('hex')

        await logEventDeletion({
          eventId: id,
          deletionType: 'crawler_expired',
          title: typeof ev?.Title === 'string' ? ev.Title : undefined,
          publisherId: typeof rawEv?.publisherId === 'string' ? rawEv.publisherId : undefined,
          correlationId,
        })
        const deletedAt = new Date()
        // Guard deletedAt absence in the filter → idempotent if two sweeps overlap.
        await eventsCol.updateOne({ _id: doc._id, deletedAt: { $exists: false } }, { $set: { deletedAt, isActive: false } })
        await softDeleteEventStatsData(id, deletedAt)
        await deleteEventCloudinaryMedia(doc, correlationId)
        deleted++
      } catch (err) {
        console.error('[crawler/cleanup] failed to soft-delete', id, err instanceof Error ? err.message : String(err))
      }
    }
    console.info(`[crawler/cleanup] soft-deleted ${deleted} unpublished crawler draft(s) older than 7d`)
    return deleted
  } catch (err) {
    console.error('[crawler/cleanup] sweep error:', err instanceof Error ? err.message : String(err))
    return 0
  }
}

/**
 * Throttled, fire-and-forget trigger for the sweep — called opportunistically from the
 * crawler ingest so cleanup runs during normal crawler activity without a separate
 * scheduler. Runs at most once per hour per process; never blocks the caller.
 */
export function maybeSweepExpiredCrawlerDrafts(): void {
  const now = Date.now()
  if (now - lastSweepAt < SWEEP_THROTTLE_MS) return
  lastSweepAt = now
  void sweepExpiredCrawlerDrafts()
}

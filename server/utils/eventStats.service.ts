import { getMongoConnection } from '~/server/utils/mongodb'

/**
 * Stamp deletedAt on all statistics data of a soft-deleted event
 * (eventStats, eventOccurrenceStats, eventInteractions).
 * eventLogs is intentionally untouched — the recent-activity feed keeps showing deletions.
 *
 * INVARIANT: every event with deletedAt must have all its stats docs stamped.
 * The event doc is stamped first (callers), then this runs; it is not atomic.
 * Failures are retried once here, and scripts/cleanup-orphan-stats.js doubles
 * as a consistency sweep that re-stamps anything missed.
 */
export async function softDeleteEventStatsData(eventId: string, deletedAt: Date) {
  try {
    await stampStats(eventId, deletedAt)
  } catch (err) {
    console.error('[EventStats] stamp failed, retrying once:', err instanceof Error ? err.message : err)
    await stampStats(eventId, deletedAt)
  }
}

async function stampStats(eventId: string, deletedAt: Date) {
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()

  await Promise.all([
    db.collection(config.mongodbCollectionEventStats || 'eventStats')
      .updateMany({ eventId }, { $set: { deletedAt } }),
    db.collection(config.mongodbCollectionEventOccurrenceStats || 'eventOccurrenceStats')
      .updateMany({ eventId }, { $set: { deletedAt } }),
    db.collection(config.mongodbCollectionEventInteractions || 'eventInteractions')
      .updateMany({ eventId }, { $set: { deletedAt } }),
  ])
}

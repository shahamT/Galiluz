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

/**
 * Re-stamp the denormalized `publisherId` on all stats of the given events to the NEW publisher, so when an
 * event is transferred its historical stats follow the new owner (dashboards scope stats by publisherId)
 * and nothing keeps pointing at a removed publisher. No-op for an empty list.
 */
export async function restampEventStatsPublisher(eventIds: string[], newPublisherId: string) {
  if (!eventIds.length || !newPublisherId) return
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const filter = { eventId: { $in: eventIds } }
  const update = { $set: { publisherId: newPublisherId } }
  await Promise.all([
    db.collection(config.mongodbCollectionEventStats || 'eventStats').updateMany(filter, update),
    db.collection(config.mongodbCollectionEventOccurrenceStats || 'eventOccurrenceStats').updateMany(filter, update),
    db.collection(config.mongodbCollectionEventInteractions || 'eventInteractions').updateMany(filter, update),
  ])
}

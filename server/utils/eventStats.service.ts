import { getMongoConnection } from '~/server/utils/mongodb'

/**
 * Stamp deletedAt on all statistics data of a soft-deleted event
 * (eventStats, eventOccurrenceStats, eventInteractions).
 * eventLogs is intentionally untouched — the recent-activity feed keeps showing deletions.
 */
export async function softDeleteEventStatsData(eventId: string, deletedAt: Date) {
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

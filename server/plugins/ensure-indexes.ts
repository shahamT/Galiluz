import { getMongoConnection } from '~/server/utils/mongodb'

/**
 * Creates all MongoDB indexes once at server startup (idempotent — createIndex
 * is a no-op when the index already exists). Replaces the previous ad-hoc
 * createIndex calls that ran on every interaction request.
 */
export default defineNitroPlugin(() => {
  // Fire and forget — must not block startup; failures are logged, the app
  // still works without indexes (just slower).
  ensureIndexes().catch((err) => {
    console.error('[Indexes] Failed to ensure indexes:', err instanceof Error ? err.message : err)
  })
})

async function ensureIndexes() {
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()

  const events = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')
  const interactions = db.collection(config.mongodbCollectionEventInteractions || 'eventInteractions')
  const stats = db.collection(config.mongodbCollectionEventStats || 'eventStats')
  const occStats = db.collection(config.mongodbCollectionEventOccurrenceStats || 'eventOccurrenceStats')
  const eventLogs = db.collection(config.mongodbCollectionEventLogs || 'eventLogs')
  const publishers = db.collection(config.mongodbCollectionPublishers || 'publishers')

  await Promise.all([
    // Public events feed + portal queries
    events.createIndex({ isActive: 1, deletedAt: 1, 'event.occurrences.startTime': 1 }),
    events.createIndex({ 'event.publisherId': 1 }),
    events.createIndex({ 'rawEvent.publisher.waId': 1 }),

    // Interactions (moved from interact.post.ts)
    interactions.createIndex({ eventId: 1, action: 1, timestamp: -1 }),
    interactions.createIndex({ eventId: 1, action: 1, visitorId: 1 }),
    interactions.createIndex({ publisherId: 1, timestamp: -1 }),

    // Stats (moved from interact.post.ts)
    stats.createIndex({ eventId: 1 }, { unique: true }),
    stats.createIndex({ publisherId: 1 }),
    occStats.createIndex({ eventId: 1, occurrenceDate: 1 }, { unique: true }),
    occStats.createIndex({ publisherId: 1, occurrenceDate: 1 }),

    // Activity / auth
    eventLogs.createIndex({ publisherId: 1, createdAt: -1 }),
    publishers.createIndex({ waId: 1 }, { unique: true }),
  ])

  console.info('[Indexes] All indexes ensured')
}

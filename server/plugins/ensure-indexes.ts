import { getMongoConnection } from '~/server/utils/mongodb'

/**
 * Creates all MongoDB indexes and schema validators once at server startup
 * (idempotent). Replaces the previous ad-hoc createIndex calls that ran on
 * every interaction request.
 */
export default defineNitroPlugin(() => {
  // Fire and forget — must not block startup; failures are logged, the app
  // still works without indexes (just slower). One delayed retry covers slow
  // Atlas cold starts.
  withRetry('Indexes', ensureIndexes)
  withRetry('Schema', ensureSchemaValidation)
})

function withRetry(label: string, fn: () => Promise<void>, retryDelayMs = 10_000) {
  fn().catch((err) => {
    console.error(`[${label}] First attempt failed, retrying in ${retryDelayMs / 1000}s:`, err instanceof Error ? err.message : err)
    setTimeout(() => {
      fn().catch((err2) => {
        console.error(`[${label}] Retry failed:`, err2 instanceof Error ? err2.message : err2)
      })
    }, retryDelayMs)
  })
}

async function ensureIndexes() {
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()

  const events = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')
  const interactions = db.collection(config.mongodbCollectionEventInteractions || 'eventInteractions')
  const stats = db.collection(config.mongodbCollectionEventStats || 'eventStats')
  const occStats = db.collection(config.mongodbCollectionEventOccurrenceStats || 'eventOccurrenceStats')
  const eventLogs = db.collection(config.mongodbCollectionEventLogs || 'eventLogs')
  const publishers = db.collection(config.mongodbCollectionPublishers || 'publishers')
  const authLogs = db.collection(config.mongodbCollectionAuthLogs || 'authLogs')
  const rawMessages = db.collection(config.mongodbCollectionRawMessages || 'raw_messages')

  const DAY = 24 * 60 * 60

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

    // Retention: raw logs are derivable/transient — bound their growth.
    // (eventLogs and the stats aggregates are kept forever by design.)
    interactions.createIndex({ timestamp: 1 }, { expireAfterSeconds: 90 * DAY }),
    authLogs.createIndex({ timestamp: 1 }, { expireAfterSeconds: 30 * DAY }),
    rawMessages.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7 * DAY }),
  ])

  console.info('[Indexes] All indexes ensured')
}

/**
 * Type-level guards on the core collections ($jsonSchema, validationLevel
 * 'moderate': new inserts and updates to valid docs must conform; legacy
 * documents stay writable). Deliberately permissive — full business
 * validation lives in the app layer (eventValidation.ts); this is the
 * backstop against structurally broken documents entering the DB.
 */
async function ensureSchemaValidation() {
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()

  const eventsName = config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events'
  const publishersName = config.mongodbCollectionPublishers || 'publishers'

  await db.command({
    collMod: eventsName,
    validationLevel: 'moderate',
    validationAction: 'error',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        properties: {
          isActive: { bsonType: 'bool' },
          deletedAt: { bsonType: 'date' },
          event: {
            bsonType: ['object', 'null'],
            properties: {
              Title: { bsonType: 'string' },
              publisherId: { bsonType: 'string' },
              occurrences: {
                bsonType: 'array',
                items: {
                  bsonType: 'object',
                  properties: {
                    date: { bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}' },
                    startTime: { bsonType: 'string' },
                    endTime: { bsonType: ['string', 'null'] },
                    hasTime: { bsonType: 'bool' },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  await db.command({
    collMod: publishersName,
    validationLevel: 'moderate',
    validationAction: 'error',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['waId'],
        properties: {
          waId: { bsonType: 'string' },
          status: { bsonType: 'string' },
          type: { bsonType: 'string' },
          fullName: { bsonType: 'string' },
        },
      },
    },
  })

  console.info('[Schema] Validators applied to events + publishers')
}

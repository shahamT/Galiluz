/**
 * MongoDB index migration script.
 * Run once after deployment: node scripts/ensure-indexes.js
 *
 * Creates indexes for the events collection to support:
 * - Date-range queries on occurrences.startTime (primary query pattern)
 * - isActive filter (always applied)
 * - Category filter on event.categories and event.mainCategory
 */
// Requires env vars: MONGODB_URI, MONGODB_DB_NAME (and optionally MONGODB_COLLECTION_EVENTS)
// Example: MONGODB_URI=... MONGODB_DB_NAME=... node scripts/ensure-indexes.js
import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB_NAME
const collectionName = process.env.MONGODB_COLLECTION_EVENTS || 'events'

if (!uri || !dbName) {
  console.error('Missing MONGODB_URI or MONGODB_DB_NAME environment variables.')
  process.exit(1)
}

const client = new MongoClient(uri)

try {
  await client.connect()
  const db = client.db(dbName)
  const col = db.collection(collectionName)

  const indexes = [
    // Primary query: active events with future occurrences (cutoff + date range)
    {
      key: { isActive: 1, 'event.occurrences.startTime': 1 },
      name: 'isActive_occurrences_startTime',
    },
    // Category filter support
    {
      key: { 'event.categories': 1 },
      name: 'event_categories',
    },
    {
      key: { 'event.mainCategory': 1 },
      name: 'event_mainCategory',
    },
  ]

  for (const { key, name } of indexes) {
    const result = await col.createIndex(key, { name, background: true })
    console.log(`Index ready: ${result}`)
  }

  console.log('All indexes ensured successfully.')
} finally {
  await client.close()
}

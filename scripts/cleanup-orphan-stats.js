/**
 * One-time migration: stamp deletedAt on orphaned stats data.
 *
 * Historical hard-deletes removed event documents but left their statistics behind
 * (eventStats / eventOccurrenceStats / eventInteractions). With soft delete in place,
 * stats of deleted events are excluded by a deletedAt stamp — this script applies that
 * stamp to all stats rows whose event no longer exists, instead of deleting them.
 *
 * Usage: node scripts/cleanup-orphan-stats.js
 * Reads MONGODB_URI / MONGODB_DB_NAME and collection names from .env at the repo root.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const env = {}
  const raw = readFileSync(resolve(rootDir, '.env'), 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    env[key] = value
  }
  return env
}

const env = loadEnv()
const uri = env.MONGODB_URI
const dbName = env.MONGODB_DB_NAME
if (!uri || !dbName) {
  console.error('MONGODB_URI / MONGODB_DB_NAME missing from .env')
  process.exit(1)
}

const eventsColName = env.MONGODB_COLLECTION_EVENTS_WA_BOT || env.MONGODB_COLLECTION_EVENTS || 'events'
const statsCollections = [
  env.MONGODB_COLLECTION_EVENT_STATS || 'eventStats',
  env.MONGODB_COLLECTION_EVENT_OCCURRENCE_STATS || 'eventOccurrenceStats',
  env.MONGODB_COLLECTION_EVENT_INTERACTIONS || 'eventInteractions',
]

const client = new MongoClient(uri)
try {
  await client.connect()
  const db = client.db(dbName)
  console.log(`Connected to ${dbName} (events collection: ${eventsColName})`)

  const eventIds = (await db.collection(eventsColName).find({}, { projection: { _id: 1 } }).toArray())
    .map((d) => d._id.toString())
  console.log(`${eventIds.length} event documents exist`)

  const deletedAt = new Date()
  for (const colName of statsCollections) {
    const col = db.collection(colName)
    const result = await col.updateMany(
      { eventId: { $nin: eventIds }, deletedAt: { $exists: false } },
      { $set: { deletedAt, orphaned: true } },
    )
    console.log(`${colName}: stamped ${result.modifiedCount} orphaned docs`)
  }
  console.log('Done.')
} finally {
  await client.close()
}

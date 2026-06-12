/**
 * Stats reset — wipes ALL statistics data so the platform starts collecting fresh.
 *
 * Deletes every document from eventStats, eventOccurrenceStats, and eventInteractions.
 * eventLogs is intentionally LEFT UNTOUCHED (append-only activity feed, kept forever).
 *
 * Why: legacy rows were keyed by the composite `<eventId>-<occurrenceIndex>` id format,
 * so cleanup-orphan-stats.js (which compares against bare ObjectIds) mass-flagged them
 * deletedAt + orphaned. They no longer count toward dashboards and aren't cleanly
 * recoverable. Now that interactions are written with the bare ObjectId, we start clean.
 *
 * SAFETY: dry-run by default — only prints counts. Pass --confirm to actually delete.
 *
 * Usage:
 *   node scripts/reset-stats.js                         # preview the .env DB (no changes)
 *   node scripts/reset-stats.js --confirm               # delete all stats docs in the .env DB
 *   node scripts/reset-stats.js --db valley_luz_app     # preview a specific DB (e.g. prod)
 *   node scripts/reset-stats.js --db valley_luz_app --confirm   # delete in that DB
 * Reads MONGODB_URI / MONGODB_DB_NAME and collection names from .env at the repo root.
 * --db overrides MONGODB_DB_NAME so prod can be targeted without editing .env.
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
const dbArgIdx = process.argv.indexOf('--db')
const dbName = dbArgIdx !== -1 ? process.argv[dbArgIdx + 1] : env.MONGODB_DB_NAME
if (!uri || !dbName) {
  console.error('MONGODB_URI / MONGODB_DB_NAME missing (set in .env or pass --db <name>)')
  process.exit(1)
}

const confirmed = process.argv.includes('--confirm')

// eventLogs is deliberately NOT in this list — the activity feed is kept forever.
const statsCollections = [
  env.MONGODB_COLLECTION_EVENT_STATS || 'eventStats',
  env.MONGODB_COLLECTION_EVENT_OCCURRENCE_STATS || 'eventOccurrenceStats',
  env.MONGODB_COLLECTION_EVENT_INTERACTIONS || 'eventInteractions',
]

const client = new MongoClient(uri)
try {
  await client.connect()
  const db = client.db(dbName)
  console.log(`Connected to ${dbName}`)
  console.log(confirmed ? '*** --confirm passed: DELETING ***' : '*** DRY RUN (no changes) — pass --confirm to delete ***')

  for (const colName of statsCollections) {
    const col = db.collection(colName)
    const count = await col.countDocuments({})
    if (confirmed) {
      const res = await col.deleteMany({})
      console.log(`${colName}: deleted ${res.deletedCount} of ${count} docs`)
    } else {
      console.log(`${colName}: ${count} docs would be deleted`)
    }
  }
  console.log(confirmed ? 'Done — stats reset.' : 'Dry run complete — no changes made.')
} finally {
  await client.close()
}

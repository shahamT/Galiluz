/**
 * Migration: normalize event.occurrences[].startTime / endTime to ISO 8601 strings.
 *
 * Historical documents store startTime as a BSON Date while newer writers store
 * ISO strings — every query has to match both variants (see buildEventsQuery).
 * This script converts all Date values to ISO strings so a single canonical
 * format remains.
 *
 * Usage:
 *   node scripts/migrate-starttime.js          # dry-run: report counts only
 *   node scripts/migrate-starttime.js --apply  # perform the migration
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const apply = process.argv.includes('--apply')

function loadEnv() {
  const env = {}
  const raw = readFileSync(resolve(rootDir, '.env'), 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
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

const client = new MongoClient(uri)
try {
  await client.connect()
  const db = client.db(dbName)
  const col = db.collection(eventsColName)
  console.log(`Connected to ${dbName}.${eventsColName} (${apply ? 'APPLY' : 'dry-run'})`)

  const docs = await col.find(
    { 'event.occurrences': { $exists: true, $ne: [] } },
    { projection: { 'event.occurrences': 1 } },
  ).toArray()

  let stringCount = 0
  let dateCount = 0
  let otherCount = 0
  const toMigrate = []

  for (const doc of docs) {
    const occs = doc.event?.occurrences || []
    let needsMigration = false
    for (const occ of occs) {
      for (const field of ['startTime', 'endTime']) {
        const v = occ?.[field]
        if (v === null || v === undefined) continue
        if (typeof v === 'string') stringCount++
        else if (v instanceof Date) { dateCount++; needsMigration = true }
        else otherCount++
      }
    }
    if (needsMigration) toMigrate.push(doc)
  }

  console.log(`${docs.length} events scanned`)
  console.log(`startTime/endTime values: ${stringCount} ISO strings, ${dateCount} BSON Dates, ${otherCount} other`)
  console.log(`${toMigrate.length} events need migration`)

  if (!apply || toMigrate.length === 0) {
    if (!apply && toMigrate.length > 0) console.log('Re-run with --apply to migrate.')
    process.exit(0)
  }

  let migrated = 0
  for (const doc of toMigrate) {
    const occs = (doc.event.occurrences || []).map((occ) => {
      const out = { ...occ }
      for (const field of ['startTime', 'endTime']) {
        if (out[field] instanceof Date) out[field] = out[field].toISOString()
      }
      return out
    })
    await col.updateOne({ _id: doc._id }, { $set: { 'event.occurrences': occs } })
    migrated++
  }
  console.log(`Migrated ${migrated} events. Done.`)
} finally {
  await client.close()
}

/**
 * Backfill event.publisherPhone from the publisher's waId — one-time, idempotent, re-runnable.
 *
 * The public "יצירת קשר עם המפרסם" button builds a wa.me link from event.publisherPhone.
 * Portal- and crawler-created events historically stored it empty (only the legacy wa-bot
 * path set it), so the button was disabled. This fills it from the event's publisher
 * (publishers.waId). Events with no event.publisherId (raw drafts, event:null) or an
 * unresolvable / waId-less publisher are skipped.
 *
 * Re-runs only touch events still missing the phone, so it's safe to run again.
 *
 * Env: reads repo-root .env if present, then overlays process.env (process.env wins).
 *
 * Usage:
 *   node scripts/backfill-event-publisher-phone.js            # apply
 *   node scripts/backfill-event-publisher-phone.js --dry-run  # report only
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient, ObjectId } from 'mongodb'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DRY_RUN = process.argv.includes('--dry-run')

function loadEnv() {
  const env = {}
  try {
    const raw = readFileSync(resolve(rootDir, '.env'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    // No .env file (e.g. prod shell) — rely on process.env below.
  }
  return { ...env, ...process.env }
}

const env = loadEnv()
const uri = env.MONGODB_URI
const dbName = env.MONGODB_DB_NAME
if (!uri || !dbName) {
  console.error('MONGODB_URI / MONGODB_DB_NAME missing (set in .env or the environment)')
  process.exit(1)
}

const eventsColName = env.MONGODB_COLLECTION_EVENTS || 'events'
const publishersColName = env.MONGODB_COLLECTION_PUBLISHERS || 'publishers'

const client = new MongoClient(uri)
try {
  await client.connect()
  const db = client.db(dbName)
  console.log(`Connected to ${dbName} — events: ${eventsColName}, publishers: ${publishersColName}${DRY_RUN ? ' [DRY RUN]' : ''}`)

  const events = db.collection(eventsColName)
  const publishers = db.collection(publishersColName)

  // Events missing a publisher phone but with a publisherId to resolve it from
  // (raw drafts with event:null have no event.publisherId → excluded).
  const pending = await events
    .find({
      'event.publisherId': { $exists: true, $nin: [null, ''] },
      $or: [
        { 'event.publisherPhone': { $exists: false } },
        { 'event.publisherPhone': '' },
        { 'event.publisherPhone': null },
      ],
    })
    .project({ _id: 1, 'event.publisherId': 1 })
    .toArray()

  console.log(`${pending.length} event(s) missing publisherPhone`)

  // Batch-resolve publisher waIds in one query.
  const ids = [...new Set(pending.map((e) => e.event?.publisherId).filter(Boolean))]
  const validOids = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id))
  const pubDocs = validOids.length
    ? await publishers.find({ _id: { $in: validOids } }, { projection: { waId: 1 } }).toArray()
    : []
  const waById = new Map(pubDocs.map((p) => [p._id.toString(), typeof p.waId === 'string' ? p.waId : '']))

  let updated = 0
  let skipped = 0
  for (const ev of pending) {
    const pubId = ev.event?.publisherId
    const waId = pubId ? waById.get(pubId) : ''
    if (!waId) {
      skipped++
      console.warn(`  skip event ${ev._id}: publisher ${pubId || '(none)'} has no waId`)
      continue
    }
    if (!DRY_RUN) await events.updateOne({ _id: ev._id }, { $set: { 'event.publisherPhone': waId } })
    updated++
  }

  console.log(`Done.${DRY_RUN ? ' [DRY RUN — no writes]' : ''} ${DRY_RUN ? 'Would update' : 'Updated'} ${updated} event(s); skipped ${skipped}.`)
} finally {
  await client.close()
}

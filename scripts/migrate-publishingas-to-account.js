/**
 * publishingAs → accounts.title migration — one-time, idempotent, re-runnable.
 *
 * The account name no longer lives on the publisher (`publishingAs`); it lives on
 * `accounts.title`, with `accountName` as the pending-period carrier. This migration
 * removes the legacy `publishingAs` field from every publisher:
 *   - has accountId (approved/has account): `accounts.title` was seeded from
 *     publishingAs at approval, so it's already correct — backfill only if somehow
 *     empty, then $unset publishingAs.
 *   - no accountId (pending, not yet approved): move publishingAs → accountName (so
 *     approval still creates the right account title), then $unset publishingAs.
 *   - ghosts have no publishingAs → untouched.
 * Also drops the dead `profileName` field (stored at bot registration, never read).
 *
 * After running, no publisher retains `publishingAs`/`profileName`, so re-runs no-op.
 *
 * Env: reads repo-root .env if present, then overlays process.env (process.env wins).
 *
 * Usage:
 *   node scripts/migrate-publishingas-to-account.js            # apply
 *   node scripts/migrate-publishingas-to-account.js --dry-run  # report only
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

const publishersColName = env.MONGODB_COLLECTION_PUBLISHERS || 'publishers'
const accountsColName = env.MONGODB_COLLECTION_ACCOUNTS || 'accounts'

const client = new MongoClient(uri)
try {
  await client.connect()
  const db = client.db(dbName)
  console.log(`Connected to ${dbName} — publishers: ${publishersColName}, accounts: ${accountsColName}${DRY_RUN ? ' [DRY RUN]' : ''}`)

  const publishers = db.collection(publishersColName)
  const accounts = db.collection(accountsColName)

  const pending = await publishers
    .find({ publishingAs: { $exists: true } })
    .project({ _id: 1, publishingAs: 1, accountId: 1, accountName: 1, waId: 1 })
    .toArray()

  console.log(`${pending.length} publisher(s) still carry publishingAs`)

  let linked = 0
  let toCarrier = 0
  let titlesBackfilled = 0

  for (const pub of pending) {
    const publishingAs = typeof pub.publishingAs === 'string' ? pub.publishingAs : ''

    if (pub.accountId) {
      // Account-linked: title already seeded from publishingAs at approval. Backfill only if empty.
      try {
        const acc = await accounts.findOne({ _id: new ObjectId(pub.accountId) }, { projection: { title: 1 } })
        if (acc && !acc.title && publishingAs) {
          if (!DRY_RUN) await accounts.updateOne({ _id: new ObjectId(pub.accountId) }, { $set: { title: publishingAs } })
          titlesBackfilled++
        }
      } catch {
        console.warn(`  publisher ${pub._id}: invalid accountId ${pub.accountId} — skipping title backfill`)
      }
      if (!DRY_RUN) await publishers.updateOne({ _id: pub._id }, { $unset: { publishingAs: '' } })
      linked++
    } else {
      // Pending (no account yet): carry the name forward as accountName for approval.
      const update = { $unset: { publishingAs: '' } }
      if (!pub.accountName && publishingAs) update.$set = { accountName: publishingAs }
      if (!DRY_RUN) await publishers.updateOne({ _id: pub._id }, update)
      toCarrier++
    }
  }

  // Drop the dead profileName field everywhere (never read).
  const profileNameCount = await publishers.countDocuments({ profileName: { $exists: true } })
  if (!DRY_RUN && profileNameCount) {
    await publishers.updateMany({ profileName: { $exists: true } }, { $unset: { profileName: '' } })
  }

  console.log(`Done.${DRY_RUN ? ' [DRY RUN — no writes]' : ''}`)
  console.log(`  publishingAs removed: ${linked} account-linked, ${toCarrier} pending→accountName (${titlesBackfilled} account titles backfilled)`)
  console.log(`  profileName ${DRY_RUN ? 'would be ' : ''}removed from ${profileNameCount} doc(s)`)
} finally {
  await client.close()
}

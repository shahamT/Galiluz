/**
 * Accounts backfill — one-time, idempotent, re-runnable migration.
 *
 * Brings an existing DB to the accounts structure: every publisher that lacks an
 * `accountId` gets a freshly created account (title = publishingAs, falling back to
 * waId) and is stamped with that account's id. Publishers that already have an
 * `accountId` are skipped, so re-runs are safe.
 *
 * Env: reads .env at the repo root if present, then overlays process.env (process.env
 * wins). So it runs locally (.env) and on the prod shell (env vars, no .env file).
 *
 * Usage:
 *   node scripts/backfill-accounts.js            # apply
 *   node scripts/backfill-accounts.js --dry-run  # report only, no writes
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'

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
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      env[key] = value
    }
  } catch {
    // No .env file (e.g. prod shell) — rely on process.env below.
  }
  // process.env overrides the .env file so prod env vars win.
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

  // Only publishers missing an accountId need work (idempotent on re-run).
  const pending = await publishers
    .find({ $or: [{ accountId: { $exists: false } }, { accountId: null }, { accountId: '' }] })
    .project({ _id: 1, publishingAs: 1, waId: 1 })
    .toArray()

  const total = await publishers.countDocuments({})
  console.log(`${total} publishers total; ${pending.length} missing an accountId`)

  let created = 0
  for (const pub of pending) {
    const title = pub.publishingAs || pub.waId || 'Account'
    if (DRY_RUN) {
      console.log(`  would create account "${title}" for publisher ${pub._id}`)
      created++
      continue
    }
    const { insertedId } = await accounts.insertOne({
      title,
      isActive: true,
      createdAt: new Date(),
    })
    await publishers.updateOne({ _id: pub._id }, { $set: { accountId: insertedId.toString() } })
    created++
    console.log(`  created account ${insertedId} ("${title}") for publisher ${pub._id}`)
  }

  console.log(`Done. ${DRY_RUN ? 'Would create' : 'Created'} ${created} account(s); skipped ${total - pending.length} already-linked.`)
} finally {
  await client.close()
}

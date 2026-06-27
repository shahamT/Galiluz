/**
 * DEV cleanup: hard-delete a publisher + its account by phone, so the website
 * registration flow can be tested repeatedly from a clean slate.
 *
 * DEV ONLY — this HARD-deletes (bypasses the soft-delete invariant). It refuses to
 * run unless the target DB name looks like dev (contains "dev"); pass --force to
 * override (don't, against prod). Events are NOT touched (registration creates none).
 *
 * Usage:
 *   node scripts/dev-remove-publisher.js                # default 0507153850
 *   node scripts/dev-remove-publisher.js 0501234567     # a specific phone
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient, ObjectId } from 'mongodb'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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
    // No .env file — rely on process.env.
  }
  return { ...env, ...process.env }
}

function normalise(raw) {
  const d = String(raw || '').replace(/\D/g, '')
  if (d.startsWith('972') && d.length === 12) return d
  if (d.startsWith('05') && d.length === 10) return '972' + d.slice(1)
  if (d.startsWith('5') && d.length === 9) return '972' + d
  return d
}

const env = loadEnv()
const force = process.argv.includes('--force')
const phoneArg = process.argv.slice(2).find((a) => !a.startsWith('--')) || '0507153850'
const waId = normalise(phoneArg)

const uri = env.MONGODB_URI
const dbName = env.MONGODB_DB_NAME
if (!uri || !dbName) {
  console.error('MONGODB_URI / MONGODB_DB_NAME missing (set in .env or the environment)')
  process.exit(1)
}
if (!/dev/i.test(dbName) && !force) {
  console.error(`Refusing: DB "${dbName}" does not look like dev. Pass --force to override.`)
  process.exit(1)
}
if (!waId || waId.length < 11) {
  console.error(`Could not normalise phone "${phoneArg}" to a waId`)
  process.exit(1)
}

const client = new MongoClient(uri)
try {
  await client.connect()
  const db = client.db(dbName)
  const publishers = db.collection(env.MONGODB_COLLECTION_PUBLISHERS || 'publishers')
  const accounts = db.collection(env.MONGODB_COLLECTION_ACCOUNTS || 'accounts')
  const memberships = db.collection(env.MONGODB_COLLECTION_MEMBERSHIPS || 'memberships')

  console.log(`Target: ${dbName} — waId ${waId}`)
  const pub = await publishers.findOne({ waId })
  if (!pub) {
    console.log('No publisher with that phone — nothing to remove.')
  } else {
    if (pub.accountId) {
      try {
        const r = await accounts.deleteOne({ _id: new ObjectId(pub.accountId) })
        console.log(`Deleted account ${pub.accountId} (${r.deletedCount})`)
      } catch {
        console.warn(`Could not delete account ${pub.accountId} (invalid id?)`)
      }
    } else {
      console.log('Publisher had no accountId (never approved) — no account to delete.')
    }
    // Remove their memberships too (owner + any platform staff role) so none are orphaned.
    const mr = await memberships.deleteMany({ publisherId: pub._id.toString() })
    console.log(`Deleted ${mr.deletedCount} membership(s)`)
    const pr = await publishers.deleteOne({ waId })
    console.log(`Deleted publisher ${waId} (status was "${pub.status}") (${pr.deletedCount})`)
  }
  console.log('Done — register this number again for a clean test.')
} finally {
  await client.close()
}

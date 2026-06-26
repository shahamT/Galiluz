/**
 * Grant or revoke a Galiluz-management (platform) role for a publisher — the supported way to
 * manage staff now that `memberships` is the source of truth for roles (there is no admin UI yet).
 *
 * A platform role is a membership in the single `kind:'platform'` account:
 *   - super_admin → full admin portal + all platform powers (the old "manager").
 *   - viewer      → read-only admin portal.
 * The publisher must already exist (be registered/approved) — this only manages their staff role,
 * never their business account/owner membership.
 *
 * Env: reads .env at the repo root if present, then overlays process.env (process.env wins) — so it
 * runs locally (.env) and on the prod shell (env vars, no .env file).
 *
 * Usage:
 *   node scripts/set-platform-role.js <phone> super_admin     # grant super_admin
 *   node scripts/set-platform-role.js <phone> viewer          # grant viewer
 *   node scripts/set-platform-role.js <phone> --remove        # revoke any platform role
 *   node scripts/set-platform-role.js <phone> super_admin --dry-run
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const REMOVE = argv.includes('--remove')
const positional = argv.filter((a) => !a.startsWith('--'))
const rawPhone = positional[0]
const role = REMOVE ? null : positional[1]

const VALID_ROLES = ['super_admin', 'viewer']
if (!rawPhone || (!REMOVE && !VALID_ROLES.includes(role))) {
  console.error('Usage: node scripts/set-platform-role.js <phone> <super_admin|viewer>   (or --remove)')
  process.exit(1)
}

/** Normalize an Israeli phone to a bare `972…` waId (best-effort; matches stored waIds). */
function normalizeWaId(input) {
  const digits = String(input).replace(/\D/g, '')
  if (digits.startsWith('972')) return digits
  if (digits.startsWith('0')) return `972${digits.slice(1)}`
  return digits
}

function loadEnv() {
  const env = {}
  try {
    const raw = readFileSync(resolve(rootDir, '.env'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq === -1) continue
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* no .env (prod shell) — rely on process.env */ }
  return { ...env, ...process.env }
}

const env = loadEnv()
const uri = env.MONGODB_URI
const dbName = env.MONGODB_DB_NAME
if (!uri || !dbName) {
  console.error('MONGODB_URI / MONGODB_DB_NAME missing (set in .env or the environment)')
  process.exit(1)
}

const publishersCol = env.MONGODB_COLLECTION_PUBLISHERS || 'publishers'
const accountsCol = env.MONGODB_COLLECTION_ACCOUNTS || 'accounts'
const membershipsCol = env.MONGODB_COLLECTION_MEMBERSHIPS || 'memberships'

const waId = normalizeWaId(rawPhone)
const client = new MongoClient(uri)
try {
  await client.connect()
  const db = client.db(dbName)
  console.log(`Connected to ${dbName}${DRY_RUN ? ' [DRY RUN]' : ''} — target waId: ${waId}`)

  const publishers = db.collection(publishersCol)
  const pub = await publishers.findOne({ waId }, { projection: { _id: 1, fullName: 1, status: 1 } })
  if (!pub) {
    console.error(`No publisher found with waId ${waId}. Register/approve them first.`)
    process.exit(1)
  }
  const publisherId = pub._id.toString()
  console.log(`  publisher: ${publisherId} (${pub.fullName || '—'}, status: ${pub.status || '—'})`)

  // Find-or-create the single platform account.
  const accounts = db.collection(accountsCol)
  let platform = await accounts.findOne({ kind: 'platform' }, { projection: { _id: 1 } })
  let platformId
  if (platform) {
    platformId = platform._id.toString()
  } else if (DRY_RUN) {
    platformId = '(would-create-platform)'
    console.log('  would create the platform account "Galiluz Management"')
  } else {
    const { insertedId } = await accounts.insertOne({ title: 'Galiluz Management', kind: 'platform', isActive: true, createdAt: new Date() })
    platformId = insertedId.toString()
    console.log(`  created platform account ${platformId}`)
  }

  const memberships = db.collection(membershipsCol)

  if (REMOVE) {
    if (DRY_RUN) {
      const existing = await memberships.findOne({ publisherId, accountId: platformId })
      console.log(existing ? `  would REMOVE platform membership (role: ${existing.role})` : '  no platform membership to remove')
    } else {
      const res = await memberships.deleteOne({ publisherId, accountId: platformId })
      console.log(res.deletedCount ? '  ✓ removed platform membership' : '  no platform membership existed')
    }
  } else {
    if (DRY_RUN) {
      const existing = await memberships.findOne({ publisherId, accountId: platformId })
      console.log(existing ? `  would SET role to '${role}' (currently '${existing.role}')` : `  would CREATE '${role}' platform membership`)
    } else {
      // Upsert the role on the unique {publisherId, accountId} pair (changing role is allowed here,
      // unlike ensureMembership which never downgrades — this command IS the deliberate role change).
      await memberships.updateOne(
        { publisherId, accountId: platformId },
        { $set: { role, status: 'active' }, $setOnInsert: { publisherId, accountId: platformId, createdAt: new Date() } },
        { upsert: true },
      )
      console.log(`  ✓ ${pub.fullName || waId} is now a platform '${role}'`)
    }
  }

  console.log(`Done${DRY_RUN ? ' [DRY RUN — no writes]' : ''}.`)
} finally {
  await client.close()
}

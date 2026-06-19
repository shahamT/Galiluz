/**
 * Set account-level feature flags directly in the DB (there is no admin UI yet).
 *
 * Features default OFF (opt-in), so existing accounts carry no `features` object
 * until one is set here. Feature keys come from consts/features.const.js (the
 * single source of truth) so this script can never drift from the app.
 *
 * Env: reads .env at the repo root if present, then overlays process.env
 * (process.env wins) — so it runs locally (.env) and on the prod shell (env vars).
 *
 * Usage:
 *   node scripts/set-account-features.js --list
 *   node scripts/set-account-features.js <accountId> globalStats=true perEventStats=false
 *   node scripts/set-account-features.js --all-on        # enable every feature on every account
 *   node scripts/set-account-features.js --all-off       # disable every feature on every account
 *   (append --dry-run to any command to preview without writing)
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient, ObjectId } from 'mongodb'
import { FEATURE_KEYS, FEATURE_DEFAULTS } from '../consts/features.const.js'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rawArgs = process.argv.slice(2)
const DRY_RUN = rawArgs.includes('--dry-run')
const args = rawArgs.filter((a) => a !== '--dry-run')

function usage(msg) {
  if (msg) console.error(`\n${msg}`)
  console.log(`\nUsage:
  node scripts/set-account-features.js --list
  node scripts/set-account-features.js <accountId> ${FEATURE_KEYS.map((k) => `${k}=true|false`).join(' ')}
  node scripts/set-account-features.js --all-on
  node scripts/set-account-features.js --all-off
  (append --dry-run to preview)\n`)
  process.exit(msg ? 1 : 0)
}

// ── Parse + validate the requested action BEFORE connecting ──────────────────
const mode = args[0]
if (!mode) usage('No arguments given.')

let action
if (mode === '--list') {
  action = { kind: 'list' }
} else if (mode === '--all-on' || mode === '--all-off') {
  const value = mode === '--all-on'
  action = { kind: 'all', value, set: Object.fromEntries(FEATURE_KEYS.map((k) => [`features.${k}`, value])) }
} else {
  // per-account: mode is the accountId, remaining args are key=value pairs
  let oid
  try { oid = new ObjectId(mode) } catch { usage(`Invalid accountId: "${mode}"`) }
  const pairs = args.slice(1)
  if (!pairs.length) usage('No feature assignments given (e.g. globalStats=true).')
  const set = {}
  for (const p of pairs) {
    const [k, v] = p.split('=')
    if (!FEATURE_KEYS.includes(k)) usage(`Unknown feature "${k}". Known: ${FEATURE_KEYS.join(', ')}`)
    if (v !== 'true' && v !== 'false') usage(`Feature "${k}" must be true or false (got "${v}")`)
    set[`features.${k}`] = v === 'true'
  }
  action = { kind: 'one', oid, set }
}

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
  return { ...env, ...process.env }
}

const env = loadEnv()
const uri = env.MONGODB_URI
const dbName = env.MONGODB_DB_NAME
if (!uri || !dbName) {
  console.error('MONGODB_URI / MONGODB_DB_NAME missing (set in .env or the environment)')
  process.exit(1)
}
const accountsColName = env.MONGODB_COLLECTION_ACCOUNTS || 'accounts'

const client = new MongoClient(uri)
try {
  await client.connect()
  const accounts = client.db(dbName).collection(accountsColName)
  console.log(`Connected to ${dbName} — accounts: ${accountsColName}${DRY_RUN ? ' [DRY RUN]' : ''}`)

  const NOT_DELETED = { deletedAt: { $exists: false } }

  if (action.kind === 'list') {
    const docs = await accounts.find(NOT_DELETED, { projection: { title: 1, features: 1 } }).toArray()
    for (const d of docs) {
      const resolved = Object.fromEntries(
        FEATURE_KEYS.map((k) => [k, typeof d.features?.[k] === 'boolean' ? d.features[k] : FEATURE_DEFAULTS[k]]),
      )
      console.log(`  ${d._id}  "${d.title || ''}"  ${JSON.stringify(resolved)}`)
    }
    console.log(`${docs.length} account(s). (values shown are resolved with defaults)`)
  } else if (action.kind === 'all') {
    const count = await accounts.countDocuments(NOT_DELETED)
    if (DRY_RUN) {
      console.log(`would set ${JSON.stringify(action.set)} on ${count} account(s)`)
    } else {
      const res = await accounts.updateMany(NOT_DELETED, { $set: action.set })
      console.log(`set ${JSON.stringify(action.set)} on ${res.modifiedCount}/${count} account(s)`)
    }
  } else {
    const existing = await accounts.findOne({ _id: action.oid }, { projection: { title: 1 } })
    if (!existing) {
      console.error(`Account ${action.oid} not found.`)
      process.exit(1)
    }
    if (DRY_RUN) {
      console.log(`would set ${JSON.stringify(action.set)} on account ${action.oid} ("${existing.title || ''}")`)
    } else {
      await accounts.updateOne({ _id: action.oid }, { $set: action.set })
      console.log(`set ${JSON.stringify(action.set)} on account ${action.oid} ("${existing.title || ''}")`)
    }
  }
} finally {
  await client.close()
}

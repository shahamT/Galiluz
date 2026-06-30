/**
 * Break-glass: delete ALL WebAuthn passkeys for a publisher (by phone) + clear any in-flight
 * MFA/challenge state on their doc. Their next staff login falls back to OTP-only and forces
 * re-enrollment. The owner's own last-resort recovery when the admin "reset passkeys" UI is
 * unreachable (e.g. the owner themselves is locked out).
 *
 * Env: reads .env at the repo root if present, then overlays process.env (process.env wins) — so it
 * runs locally (.env) and on the prod shell (env vars, no .env file).
 *
 * Usage:
 *   node scripts/reset-passkeys.js <phone>
 *   node scripts/reset-passkeys.js <phone> --dry-run
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const rawPhone = argv.filter((a) => !a.startsWith('--'))[0]

if (!rawPhone) {
  console.error('Usage: node scripts/reset-passkeys.js <phone> [--dry-run]')
  process.exit(1)
}

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
const credsCol = env.MONGODB_COLLECTION_WEBAUTHN_CREDENTIALS || 'webauthnCredentials'

const waId = normalizeWaId(rawPhone)
const client = new MongoClient(uri)
try {
  await client.connect()
  const db = client.db(dbName)
  console.log(`Connected to ${dbName}${DRY_RUN ? ' [DRY RUN]' : ''} — target waId: ${waId}`)

  const publishers = db.collection(publishersCol)
  const pub = await publishers.findOne({ waId }, { projection: { _id: 1, fullName: 1 } })
  if (!pub) {
    console.error(`No publisher found with waId ${waId}.`)
    process.exit(1)
  }
  const publisherId = pub._id.toString()
  const count = await db.collection(credsCol).countDocuments({ publisherId })
  console.log(`  publisher: ${publisherId} (${pub.fullName || '—'}) — ${count} passkey(s)`)

  if (DRY_RUN) {
    console.log(`  would delete ${count} passkey(s) + clear MFA/challenge state`)
  } else {
    const { deletedCount } = await db.collection(credsCol).deleteMany({ publisherId })
    await publishers.updateOne(
      { _id: pub._id },
      { $unset: { mfaPendingKey: '', mfaPendingExpiresAt: '', webauthnChallenge: '', webauthnChallengeExpiresAt: '' } },
    )
    console.log(`  ✓ deleted ${deletedCount} passkey(s); next login is OTP-only + forced re-enroll`)
  }

  console.log(`Done${DRY_RUN ? ' [DRY RUN — no writes]' : ''}.`)
} finally {
  await client.close()
}

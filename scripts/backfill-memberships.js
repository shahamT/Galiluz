/**
 * Memberships backfill — one-time, idempotent, re-runnable migration (RBAC Deploy 1 → 2).
 *
 * Brings an existing DB to the multi-tenant RBAC structure WITHOUT changing behavior:
 *   A) find-or-create the single platform account (kind:'platform', "Galiluz Management");
 *   B) a platform `super_admin` membership for every `type:'manager'` publisher;
 *   C) a business `owner` membership for every publisher that has an `accountId`;
 *   D) for accountless publishers that already OWN events (legacy ghosts / on-behalf targets):
 *      create a business account + owner membership and stamp `accountId` on the publisher;
 *   E) stamp `event.accountId` (the tenant key) on every non-deleted event missing it, from the
 *      current owner's account (fallback: originalCreatorPublisherId's account). Unresolvable
 *      events are reported as orphans, never guessed.
 *
 * Idempotent: memberships upsert on the unique {publisherId,accountId} pair (existing rows are
 * left untouched — never downgrades a role); only events still missing `event.accountId` are
 * stamped. Safe to re-run — a clean second run reports 0 created / 0 stamped.
 *
 * Env: reads .env at the repo root if present, then overlays process.env (process.env wins),
 * so it runs locally (.env) and on the prod shell (env vars, no .env file).
 *
 * Usage:
 *   node scripts/backfill-memberships.js            # apply
 *   node scripts/backfill-memberships.js --dry-run  # report only, no writes
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
const membershipsColName = env.MONGODB_COLLECTION_MEMBERSHIPS || 'memberships'
// Matches the app's resolution: the wa-bot collection wins when set, else the default events one.
const eventsColName = env.MONGODB_COLLECTION_EVENTS_WA_BOT || env.MONGODB_COLLECTION_EVENTS || 'events'

const NOT_DELETED = { deletedAt: { $exists: false } }
const hasAccountId = { accountId: { $exists: true, $nin: [null, ''] } }
const noAccountId = { $or: [{ accountId: { $exists: false } }, { accountId: null }, { accountId: '' }] }

const client = new MongoClient(uri)
try {
  await client.connect()
  const db = client.db(dbName)
  console.log(
    `Connected to ${dbName} — publishers: ${publishersColName}, accounts: ${accountsColName}, ` +
    `memberships: ${membershipsColName}, events: ${eventsColName}${DRY_RUN ? ' [DRY RUN]' : ''}`,
  )

  const publishers = db.collection(publishersColName)
  const accounts = db.collection(accountsColName)
  const memberships = db.collection(membershipsColName)
  const events = db.collection(eventsColName)

  /** Idempotent upsert on the unique pair; returns 'created' | 'exists'. */
  async function ensureMembership(publisherId, accountId, role) {
    if (DRY_RUN) {
      const existing = await memberships.findOne({ publisherId, accountId }, { projection: { _id: 1 } })
      return existing ? 'exists' : 'created'
    }
    const res = await memberships.updateOne(
      { publisherId, accountId },
      { $setOnInsert: { publisherId, accountId, role, status: 'active', createdAt: new Date() } },
      { upsert: true },
    )
    return res.upsertedCount ? 'created' : 'exists'
  }

  // ── Phase A: platform account ──────────────────────────────────────────────
  console.log('\n[A] Platform account')
  let platformId
  const platform = await accounts.findOne({ kind: 'platform' }, { projection: { _id: 1 } })
  if (platform) {
    platformId = platform._id.toString()
    console.log(`  exists: ${platformId}`)
  } else if (DRY_RUN) {
    platformId = '(would-create-platform)'
    console.log('  would create platform account "Galiluz Management"')
  } else {
    const { insertedId } = await accounts.insertOne({
      title: 'Galiluz Management', kind: 'platform', isActive: true, createdAt: new Date(),
    })
    platformId = insertedId.toString()
    console.log(`  created: ${platformId}`)
  }

  // ── Phase B: super_admin memberships (one per type:'manager') ──────────────
  console.log('\n[B] Platform super_admin memberships')
  const managers = await publishers.find({ type: 'manager' }).project({ _id: 1 }).toArray()
  let saCreated = 0, saExists = 0
  for (const m of managers) {
    const r = await ensureMembership(m._id.toString(), platformId, 'super_admin')
    r === 'created' ? saCreated++ : saExists++
  }
  console.log(`  ${managers.length} manager(s): ${saCreated} created, ${saExists} already present`)

  // ── Phase C: owner memberships for publishers with an accountId ────────────
  console.log('\n[C] Business owner memberships (publishers with an account)')
  const withAccount = await publishers.find(hasAccountId).project({ _id: 1, accountId: 1 }).toArray()
  let ownerCreated = 0, ownerExists = 0
  for (const p of withAccount) {
    const r = await ensureMembership(p._id.toString(), p.accountId, 'owner')
    r === 'created' ? ownerCreated++ : ownerExists++
  }
  console.log(`  ${withAccount.length} publisher(s) with account: ${ownerCreated} created, ${ownerExists} already present`)

  // ── Phase D: accounts + owner memberships for accountless EVENT OWNERS ─────
  console.log('\n[D] Accounts for accountless publishers that own events (legacy ghosts / on-behalf)')
  const eventOwnerIds = new Set(
    (await events.distinct('event.publisherId', { ...NOT_DELETED, event: { $ne: null } }))
      .filter((id) => typeof id === 'string' && id),
  )
  const accountless = await publishers.find(noAccountId).project({ _id: 1, accountName: 1, waId: 1 }).toArray()
  // Map of publisherId → accountId, mutated as we create accounts; reused by Phase E.
  const pubAccount = new Map(withAccount.map((p) => [p._id.toString(), p.accountId]))
  let dCreated = 0
  for (const p of accountless) {
    const pid = p._id.toString()
    if (!eventOwnerIds.has(pid)) continue // no events → account is created lazily on first publish
    const title = p.accountName || p.waId || 'Account'
    if (DRY_RUN) {
      pubAccount.set(pid, '(would-create-account)')
      console.log(`  would create account "${title}" + owner membership for event-owner ${pid}`)
      dCreated++
      continue
    }
    const { insertedId } = await accounts.insertOne({ title, kind: 'business', isActive: true, createdAt: new Date() })
    const accountId = insertedId.toString()
    await publishers.updateOne({ _id: p._id }, { $set: { accountId } })
    await ensureMembership(pid, accountId, 'owner')
    pubAccount.set(pid, accountId)
    dCreated++
    console.log(`  created account ${accountId} ("${title}") + owner membership for event-owner ${pid}`)
  }
  console.log(`  ${dCreated} account(s) ${DRY_RUN ? 'would be created' : 'created'} for accountless event owners`)

  // ── Phase E: stamp event.accountId (tenant key) on events missing it ───────
  console.log('\n[E] Stamp event.accountId on non-deleted events')
  const missing = await events
    .find({
      ...NOT_DELETED,
      event: { $ne: null },
      $or: [{ 'event.accountId': { $exists: false } }, { 'event.accountId': null }, { 'event.accountId': '' }],
    })
    .project({ _id: 1, 'event.publisherId': 1, 'event.originalCreatorPublisherId': 1 })
    .toArray()

  let stamped = 0
  const orphans = []
  for (const ev of missing) {
    const owner = ev.event?.publisherId
    const creator = ev.event?.originalCreatorPublisherId
    const accountId = (owner && pubAccount.get(owner)) || (creator && pubAccount.get(creator)) || null
    if (!accountId) {
      orphans.push({ eventId: ev._id.toString(), publisherId: owner || null, originalCreatorPublisherId: creator || null })
      continue
    }
    if (!DRY_RUN) await events.updateOne({ _id: ev._id }, { $set: { 'event.accountId': accountId } })
    stamped++
  }
  console.log(`  ${missing.length} event(s) missing accountId: ${stamped} ${DRY_RUN ? 'would be stamped' : 'stamped'}, ${orphans.length} orphan(s)`)
  if (orphans.length) {
    console.log('  ⚠ orphans (no resolvable account — left unstamped, investigate manually):')
    for (const o of orphans.slice(0, 50)) console.log(`    event ${o.eventId} (publisherId=${o.publisherId}, originalCreator=${o.originalCreatorPublisherId})`)
    if (orphans.length > 50) console.log(`    …and ${orphans.length - 50} more`)
  }

  // ── Verification snapshot ──────────────────────────────────────────────────
  console.log('\n[VERIFY] Post-run counts')
  const totalPublishers = await publishers.countDocuments({})
  const totalManagers = managers.length
  const totalMemberships = await memberships.countDocuments({})
  const superAdminMemberships = await memberships.countDocuments({ accountId: DRY_RUN ? { $exists: true } : platformId, role: 'super_admin' })
  const ownerMemberships = await memberships.countDocuments({ role: 'owner' })
  const eventsTotal = await events.countDocuments({ ...NOT_DELETED, event: { $ne: null } })
  const eventsMissing = await events.countDocuments({
    ...NOT_DELETED, event: { $ne: null },
    $or: [{ 'event.accountId': { $exists: false } }, { 'event.accountId': null }, { 'event.accountId': '' }],
  })
  console.log(`  publishers: ${totalPublishers} (managers: ${totalManagers})`)
  console.log(`  memberships: ${totalMemberships} total — super_admin: ${superAdminMemberships}, owner: ${ownerMemberships}`)
  console.log(`  non-deleted events: ${eventsTotal} — still missing accountId: ${DRY_RUN ? `${eventsMissing} (before applying)` : eventsMissing}`)
  if (!DRY_RUN && eventsMissing !== orphans.length) {
    console.log(`  ⚠ expected remaining-missing (${eventsMissing}) to equal orphans (${orphans.length}); investigate.`)
  }

  console.log(`\nDone${DRY_RUN ? ' [DRY RUN — no writes]' : ''}.`)
} finally {
  await client.close()
}

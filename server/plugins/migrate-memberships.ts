import { getMongoConnection } from '~/server/utils/mongodb'
import { getPlatformAccountId, ensureMembership } from '~/server/utils/accountScope'

/**
 * ONE-TIME data migration (multi-tenant RBAC: Deploy 1 → 2). Backfills the `memberships`
 * collection and stamps `event.accountId` on existing data so the new structures become the
 * source of truth — mirrors [scripts/backfill-memberships.js](../../scripts/backfill-memberships.js).
 *
 * Runs once on server boot, then REMOVE THIS PLUGIN in the next deploy (see
 * plans/multi-account-roadmap.md). Safe to leave in temporarily — it's idempotent and a
 * unique `appSettings` marker (`migration_memberships_v1`) makes it a no-op after completion.
 *
 * Fire-and-forget: it never blocks or crashes boot. Until it finishes, reads are already correct
 * via the straggler fallbacks in accountScope, so the in-progress window is safe.
 */
const MARKER = 'migration_memberships_v1'
const LOG = '[migrate-memberships]'
const STALE_MS = 10 * 60 * 1000

export default defineNitroPlugin(() => {
  runMigration().catch((err) => console.error(LOG, 'failed:', err instanceof Error ? err.message : err))
})

async function runMigration() {
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const appSettings = db.collection(config.mongodbCollectionAppSettings || 'appSettings')

  // Race-safe claim across instances: the unique index on `appSettings.key` lets exactly one
  // booting instance own the run. Re-claim only if a prior 'running' claim is stale (crashed).
  const now = new Date()
  let claimed = false
  try {
    const res = await appSettings.findOneAndUpdate(
      {
        key: MARKER,
        status: { $ne: 'done' },
        $or: [{ status: { $ne: 'running' } }, { startedAt: { $lt: new Date(now.getTime() - STALE_MS) } }],
      },
      { $set: { status: 'running', startedAt: now }, $setOnInsert: { key: MARKER, createdAt: now } },
      { upsert: true, returnDocument: 'after' },
    )
    claimed = !!res
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) return // another instance owns it, or it's done
    throw err
  }
  if (!claimed) return

  console.info(LOG, 'starting one-time memberships + event.accountId backfill')
  const publishers = db.collection(config.mongodbCollectionPublishers || 'publishers')
  const accounts = db.collection(config.mongodbCollectionAccounts || 'accounts')
  const events = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')
  const NOT_DELETED = { deletedAt: { $exists: false } }

  // A + B) platform account + a super_admin membership for every legacy manager.
  const platformId = await getPlatformAccountId()
  const managers = await publishers.find({ type: 'manager' }).project({ _id: 1 }).toArray()
  for (const m of managers) await ensureMembership(m._id.toString(), platformId, 'super_admin')

  // C) an owner membership for every publisher that has an account.
  const withAccount = await publishers
    .find({ accountId: { $exists: true, $nin: [null, ''] } })
    .project({ _id: 1, accountId: 1 })
    .toArray()
  for (const p of withAccount) await ensureMembership(p._id.toString(), String(p.accountId), 'owner')

  // publisherId → accountId map (mutated by D), reused by E.
  const pubAccount = new Map<string, string>(withAccount.map((p) => [p._id.toString(), String(p.accountId)]))

  // D) accounts + owner memberships for accountless publishers that already OWN events
  // (legacy ghosts / on-behalf targets). Normally empty on prod (backfill-accounts already ran).
  const eventOwnerIds = new Set(
    (await events.distinct('event.publisherId', { ...NOT_DELETED, event: { $ne: null } }))
      .filter((id) => typeof id === 'string' && id),
  )
  const accountless = await publishers
    .find({ $or: [{ accountId: { $exists: false } }, { accountId: null }, { accountId: '' }] })
    .project({ _id: 1, accountName: 1, waId: 1 })
    .toArray()
  for (const p of accountless) {
    const pid = p._id.toString()
    if (!eventOwnerIds.has(pid)) continue
    const { insertedId } = await accounts.insertOne({
      title: p.accountName || p.waId || 'Account', kind: 'business', isActive: true, createdAt: new Date(),
    })
    const accId = insertedId.toString()
    await publishers.updateOne({ _id: p._id }, { $set: { accountId: accId } })
    await ensureMembership(pid, accId, 'owner')
    pubAccount.set(pid, accId)
  }

  // E) stamp event.accountId (the tenant key) on every non-deleted event missing it.
  const missing = await events
    .find({
      ...NOT_DELETED,
      event: { $ne: null },
      $or: [{ 'event.accountId': { $exists: false } }, { 'event.accountId': null }, { 'event.accountId': '' }],
    })
    .project({ _id: 1, 'event.publisherId': 1, 'event.originalCreatorPublisherId': 1 })
    .toArray()
  let stamped = 0
  let orphans = 0
  for (const ev of missing) {
    const owner = ev.event?.publisherId
    const creator = ev.event?.originalCreatorPublisherId
    const accId = (owner && pubAccount.get(owner)) || (creator && pubAccount.get(creator)) || null
    if (!accId) { orphans++; continue }
    await events.updateOne({ _id: ev._id }, { $set: { 'event.accountId': accId } })
    stamped++
  }

  const counts = { superAdmins: managers.length, owners: withAccount.length, eventsStamped: stamped, orphans }
  await appSettings.updateOne(
    { key: MARKER },
    { $set: { status: 'done', completedAt: new Date(), counts } },
  )
  console.info(LOG, 'done —', JSON.stringify(counts))
}

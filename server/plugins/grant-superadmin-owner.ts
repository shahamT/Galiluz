import { getMongoConnection } from '~/server/utils/mongodb'
import { getPlatformAccountId } from '~/server/utils/accountScope'

/**
 * ONE-TIME data fix: ensure the owner (waId 972559896278) holds a platform `super_admin`
 * membership, so they resolve as super-admin again. After the RBAC refactor, roles come solely
 * from the `memberships` collection (a `super_admin` row in the single `kind:'platform'` account);
 * `publishers.type` is no longer read. The one-time backfill only covered `type:'manager'`
 * publishers, so this owner — never flagged manager — was left without the row and renders as a
 * regular business owner.
 *
 * Runs once on server boot, then REMOVE THIS PLUGIN in the next deploy. Safe to leave in
 * temporarily — it's idempotent and a unique `appSettings` marker makes it a no-op after completion.
 * Fire-and-forget: never blocks or crashes boot. Not env-gated, so it also self-heals the local
 * dev clone (which keeps this phone real). Mirrors the removed migrate-memberships.ts hook.
 */
const OWNER_WA_ID = '972559896278'
const MARKER = 'grant_superadmin_owner_972559896278_v1'
const LOG = '[grant-superadmin-owner]'
const STALE_MS = 10 * 60 * 1000

export default defineNitroPlugin(() => {
  run().catch((err) => console.error(LOG, 'failed:', err instanceof Error ? err.message : err))
})

async function run() {
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

  console.info(LOG, `starting one-time super_admin grant for ${OWNER_WA_ID}`)
  const publishers = db.collection(config.mongodbCollectionPublishers || 'publishers')
  const memberships = db.collection(config.mongodbCollectionMemberships || 'memberships')

  const pub = await publishers.findOne({ waId: OWNER_WA_ID }, { projection: { _id: 1 } })
  if (!pub) {
    // The owner exists on prod — this guards the impossible case and prevents a boot loop.
    console.error(LOG, `publisher ${OWNER_WA_ID} not found — nothing to grant`)
    await appSettings.updateOne(
      { key: MARKER },
      { $set: { status: 'done', completedAt: new Date(), error: 'publisher_not_found' } },
    )
    return
  }

  const publisherId = pub._id.toString()
  const platformId = await getPlatformAccountId()

  // Force the role (NOT ensureMembership — that only $setOnInsert and would keep a wrong existing
  // role like 'viewer'). This is the deliberate role assignment, mirroring set-platform-role.js.
  const existing = await memberships.findOne({ publisherId, accountId: platformId }, { projection: { role: 1 } })
  await memberships.updateOne(
    { publisherId, accountId: platformId },
    {
      $set: { role: 'super_admin', status: 'active' },
      $setOnInsert: { publisherId, accountId: platformId, createdAt: new Date() },
    },
    { upsert: true },
  )

  const counts = { publisherFound: true, previousRole: existing?.role || null, newRole: 'super_admin' }
  await appSettings.updateOne(
    { key: MARKER },
    { $set: { status: 'done', completedAt: new Date(), counts } },
  )
  console.info(LOG, 'done —', JSON.stringify(counts))
}

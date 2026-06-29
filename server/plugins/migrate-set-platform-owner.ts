import { getMongoConnection } from '~/server/utils/mongodb'

/**
 * ONE-TIME MIGRATION — DELETE THIS FILE ON THE NEXT DEPLOY (after it has run once on prod).
 *
 * Introduces the single `platform_owner` (the founder) above the `super_admin` staff tier. Promotes
 * the founder's platform-account membership role super_admin → platform_owner, so only they can manage
 * platform staff + the platform account's settings (authz.ts MANAGE_PLATFORM). All other staff stay
 * super_admin (operational powers, no platform governance).
 *
 * Marker-guarded so it runs exactly once; idempotent (re-running only re-sets an already-owner role).
 */
const MARKER = 'migration:set-platform-owner'
// The founder/owner — same number kept real by scripts/clone-prod-to-dev.js (KEEP_REAL_NUMBERS).
const OWNER_WA_ID = '972559896278'

export default defineNitroPlugin(() => {
  run().catch((err) =>
    console.error('[migrate:platformOwner] failed:', err instanceof Error ? err.message : String(err)),
  )
})

async function run() {
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const appSettings = db.collection(config.mongodbCollectionAppSettings || 'appSettings')

  const existing = await appSettings.findOne({ key: MARKER })
  if (existing?.done) {
    console.info('[migrate:platformOwner] already applied — skipping')
    return
  }

  const publishers = db.collection(config.mongodbCollectionPublishers || 'publishers')
  const accounts = db.collection(config.mongodbCollectionAccounts || 'accounts')
  const memberships = db.collection(config.mongodbCollectionMemberships || 'memberships')

  const owner = await publishers.findOne({ waId: OWNER_WA_ID }, { projection: { _id: 1 } })
  const platform = await accounts.findOne({ kind: 'platform' }, { projection: { _id: 1 } })

  let modified = 0
  if (owner && platform) {
    const res = await memberships.updateOne(
      { publisherId: String(owner._id), accountId: String(platform._id) },
      { $set: { role: 'platform_owner', status: 'active', updatedAt: new Date() }, $setOnInsert: { publisherId: String(owner._id), accountId: String(platform._id), createdAt: new Date() } },
      { upsert: true },
    )
    modified = res.modifiedCount + (res.upsertedCount || 0)
  } else {
    console.warn(`[migrate:platformOwner] owner publisher (${OWNER_WA_ID}) or platform account not found — nothing promoted`)
  }

  await appSettings.updateOne(
    { key: MARKER },
    { $set: { key: MARKER, done: true, ownerWaId: OWNER_WA_ID, modified, ranAt: new Date() } },
    { upsert: true },
  )
  console.info(`[migrate:platformOwner] platform_owner set for ${OWNER_WA_ID} (changed ${modified})`)
}

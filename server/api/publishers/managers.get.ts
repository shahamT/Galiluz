import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'

export default defineEventHandler(async (event) => {
  requireApiSecret(event)

  const config = useRuntimeConfig()
  const mongoUri = config.mongodbUri || process.env.MONGODB_URI
  const mongoDbName = config.mongodbDbName || process.env.MONGODB_DB_NAME
  const collectionName =
    config.mongodbCollectionPublishers ||
    process.env.MONGODB_COLLECTION_PUBLISHERS ||
    'publishers'

  if (!mongoUri || !mongoDbName) {
    return []
  }

  try {
    const { db } = await getMongoConnection()
    const collection = db.collection(collectionName)

    // Platform super-admins are members of the single `kind:'platform'` account with role
    // 'super_admin' (the post-migration source of truth). During rollout we ALSO honor the
    // legacy `type:'manager'` flag, so this list is correct before and after the data backfill
    // with no wa-bot redeploy. Non-creating lookup: if the platform account doesn't exist yet
    // (pre-migrate), the membership branch is skipped and we fall back to `type` alone.
    const accounts = db.collection(config.mongodbCollectionAccounts || 'accounts')
    const platformAccount = await accounts.findOne({ kind: 'platform' }, { projection: { _id: 1 } })

    let superAdminIds: ObjectId[] = []
    if (platformAccount) {
      const memberships = db.collection(config.mongodbCollectionMemberships || 'memberships')
      const rows = await memberships
        .find({ accountId: platformAccount._id.toString(), role: 'super_admin', status: 'active' }, { projection: { publisherId: 1 } })
        .toArray()
      superAdminIds = rows
        .map((r) => { try { return new ObjectId(String(r.publisherId)) } catch { return null } })
        .filter((x): x is ObjectId => x !== null)
    }

    const or: Record<string, unknown>[] = [{ type: 'manager' }]
    if (superAdminIds.length) or.push({ _id: { $in: superAdminIds } })

    const docs = await collection.find({ status: 'approved', $or: or }, { projection: { waId: 1 } }).toArray()
    return docs.map((d) => d.waId).filter(Boolean)
  } catch (err) {
    console.error('[PublishersAPI] Managers error:', err instanceof Error ? err.message : String(err))
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
  }
})

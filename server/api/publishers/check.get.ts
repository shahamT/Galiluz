import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'

export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const query = getQuery(event)
  const waId = typeof query.waId === 'string' ? query.waId.trim() : ''

  if (!waId) {
    return { status: 'not_found' as const }
  }

  const config = useRuntimeConfig()
  const mongoUri = config.mongodbUri || process.env.MONGODB_URI
  const mongoDbName = config.mongodbDbName || process.env.MONGODB_DB_NAME
  const collectionName =
    config.mongodbCollectionPublishers ||
    process.env.MONGODB_COLLECTION_PUBLISHERS ||
    'publishers'

  if (!mongoUri || !mongoDbName) {
    console.error('[PublishersAPI] MongoDB not configured')
    return { status: 'not_found' as const }
  }

  try {
    const { db } = await getMongoConnection()
    const collection = db.collection(collectionName)
    const doc = await collection.findOne({ waId })
    if (!doc) return { status: 'not_found' as const }
    const status = doc.status === 'approved' ? 'approved' : 'pending'
    return { status }
  } catch (err) {
    console.error('[PublishersAPI] Check error:', err instanceof Error ? err.message : String(err))
    return { status: 'not_found' as const }
  }
})

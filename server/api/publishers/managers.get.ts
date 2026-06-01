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
    const docs = await collection.find({ type: 'manager', status: 'approved' }, { projection: { waId: 1 } }).toArray()
    return docs.map((d) => d.waId).filter(Boolean)
  } catch (err) {
    console.error('[PublishersAPI] Managers error:', err instanceof Error ? err.message : String(err))
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
  }
})

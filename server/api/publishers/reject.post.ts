import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'

export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const body = await readBody<{ waId: string; reason?: string }>(event)
  const waId = typeof body?.waId === 'string' ? body.waId.trim() : ''

  if (!waId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'waId is required',
    })
  }

  const config = useRuntimeConfig()
  const mongoUri = config.mongodbUri || process.env.MONGODB_URI
  const mongoDbName = config.mongodbDbName || process.env.MONGODB_DB_NAME
  const collectionName =
    config.mongodbCollectionPublishers ||
    process.env.MONGODB_COLLECTION_PUBLISHERS ||
    'publishers'

  if (!mongoUri || !mongoDbName) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
    })
  }

  try {
    const { db } = await getMongoConnection()
    const collection = db.collection(collectionName)
    const result = await collection.deleteOne({ waId })
    if (result.deletedCount === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: 'Publisher not found',
      })
    }
    return { success: true }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    console.error('[PublishersAPI] Reject error:', err instanceof Error ? err.message : String(err))
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    })
  }
})

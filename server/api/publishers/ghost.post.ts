import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'

export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const body = await readBody<{ waId: string }>(event)
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
    await collection.createIndex({ waId: 1 }, { unique: true }).catch(() => {})
    // Idempotent: $setOnInsert only runs on INSERT, so existing records (any status) are never touched.
    await collection.updateOne(
      { waId },
      { $setOnInsert: { waId, phone: waId, status: 'ghost', createdOnBehalf: true, createdAt: new Date() } },
      { upsert: true },
    )
    return { success: true }
  } catch (err: unknown) {
    console.error('[PublishersAPI] Ghost error:', err instanceof Error ? err.message : String(err))
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    })
  }
})

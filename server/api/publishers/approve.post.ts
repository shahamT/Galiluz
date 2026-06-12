import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'
import { ensureAccountForPublisher } from '~/server/utils/accountScope'

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
    const now = new Date()
    const result = await collection.updateOne(
      { waId },
      { $set: { status: 'approved', updatedAt: now, approvedAt: now } },
    )
    if (result.matchedCount === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: 'Publisher not found',
      })
    }

    // Every approved publisher belongs to an account (auto-created, idempotent).
    const pubDoc = await collection.findOne({ waId })
    if (pubDoc) await ensureAccountForPublisher(pubDoc as Parameters<typeof ensureAccountForPublisher>[0])

    return { success: true }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    console.error('[PublishersAPI] Approve error:', err instanceof Error ? err.message : String(err))
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    })
  }
})

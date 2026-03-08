import { getMongoConnection, getDbConfig } from '~/server/utils/mongodb'
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

  const { uri, dbName, collections } = getDbConfig()

  if (!uri || !dbName) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
    })
  }

  try {
    const { db } = await getMongoConnection()
    const collection = db.collection(collections.publishers)
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

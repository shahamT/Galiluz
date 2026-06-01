import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import { getMongoConnection } from '~/server/utils/mongodb'

export interface PublisherSession {
  publisherId: string
  waId: string
  fullName: string
  publishingAs: string
  type: string
}

/**
 * Validates the Bearer token from the Authorization header.
 * Throws 401 if missing, invalid, or expired.
 * Returns publisher session info on success.
 */
export async function requirePublisherAuth(event: H3Event): Promise<PublisherSession> {
  const auth = getHeader(event, 'authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'Missing auth token' })
  }

  const hash = createHash('sha256').update(token).digest('hex')

  try {
    const config = useRuntimeConfig()
    const collectionName = config.mongodbCollectionPublishers || process.env.MONGODB_COLLECTION_PUBLISHERS || 'publishers'
    const { db } = await getMongoConnection()
    const collection = db.collection(collectionName)

    const doc = await collection.findOne(
      { authKey: hash, authKeyExpiresAt: { $gt: new Date() } },
      { projection: { _id: 1, waId: 1, fullName: 1, publishingAs: 1, type: 1 } },
    )

    if (!doc) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'Invalid or expired token' })
    }

    return {
      publisherId: doc._id.toString(),
      waId: doc.waId,
      fullName: doc.fullName || '',
      publishingAs: doc.publishingAs || '',
      type: doc.type || 'publisher',
    }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    console.error('[Auth] requirePublisherAuth error:', err instanceof Error ? err.message : String(err))
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
  }
}

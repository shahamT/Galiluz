import { createHmac } from 'node:crypto'
import type { H3Event } from 'h3'
import { getMongoConnection } from '~/server/utils/mongodb'

export interface PublisherSession {
  publisherId: string
  waId: string
  fullName: string
  publishingAs: string
  type: 'publisher' | 'manager'
  /** Account this publisher belongs to. Absent on legacy docs pre-backfill. */
  accountId?: string
  /** Per-publisher preference flags (raw, stored); resolve with getPublisherPreferences(). */
  preferences?: Record<string, unknown>
}

export interface AuthOptions {
  /** If true, throws 403 unless the authenticated user is a manager. */
  requireManager?: boolean
}

/**
 * Validates the Bearer token from the Authorization header.
 * Throws 401 if missing, invalid, or expired.
 * Throws 403 if options.requireManager is true and the user is not a manager.
 * Returns publisher session info on success.
 *
 * Usage:
 *   const session = await requirePublisherAuth(event)                        // any authenticated user
 *   const session = await requirePublisherAuth(event, { requireManager: true }) // manager only
 *
 * For resource ownership (publisher can only access own data):
 *   if (session.type !== 'manager' && resource.publisherWaId !== session.waId)
 *     throw createError({ statusCode: 403 })
 */
export async function requirePublisherAuth(event: H3Event, options: AuthOptions = {}): Promise<PublisherSession> {
  // Read from HttpOnly cookie (browser) with fallback to Authorization header (internal tools)
  const token = getCookie(event, 'galiluz_auth')?.trim()
    || (() => { const h = getHeader(event, 'authorization') ?? ''; return h.startsWith('Bearer ') ? h.slice(7).trim() : '' })()

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'Missing auth token' })
  }

  const config = useRuntimeConfig()
  const secret = config.otpSecret || process.env.OTP_SECRET || ''
  const hash = createHmac('sha256', secret).update(token).digest('hex')

  try {
    const collectionName = config.mongodbCollectionPublishers || process.env.MONGODB_COLLECTION_PUBLISHERS || 'publishers'
    const { db } = await getMongoConnection()
    const collection = db.collection(collectionName)

    // Ensure index exists for auth token lookups (idempotent)
    collection.createIndex({ authKey: 1, authKeyExpiresAt: 1 }).catch(() => {})

    const doc = await collection.findOne(
      { authKey: hash, authKeyExpiresAt: { $gt: new Date() } },
      { projection: { _id: 1, waId: 1, fullName: 1, publishingAs: 1, type: 1, status: 1, accountId: 1, preferences: 1 } },
    )

    if (!doc || doc.status !== 'approved') {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'Invalid or expired token' })
    }

    const session: PublisherSession = {
      publisherId: doc._id.toString(),
      waId: doc.waId,
      fullName: doc.fullName || '',
      publishingAs: doc.publishingAs || '',
      type: doc.type === 'manager' ? 'manager' : 'publisher',
      accountId: doc.accountId || undefined,
      preferences: doc.preferences || {},
    }

    if (options.requireManager && session.type !== 'manager') {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'manager_only' })
    }

    return session
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    console.error('[Auth] requirePublisherAuth error:', err instanceof Error ? err.message : String(err))
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
  }
}

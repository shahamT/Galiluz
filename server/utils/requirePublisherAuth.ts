import { createHmac } from 'node:crypto'
import type { H3Event } from 'h3'
import { getMongoConnection } from '~/server/utils/mongodb'
import { isSuperAdmin, isPlatformStaff } from '~/server/utils/authz'

export interface PublisherSession {
  publisherId: string
  waId: string
  fullName: string
  /** @deprecated Account name relocated to accounts.title — empty for web publishers. Resolve the display title via resolveAccountTitle({accountId, accountName, waId}). */
  publishingAs: string
  /** @deprecated Platform role moved to `platformRole` (memberships). Kept during rollout. */
  type: 'publisher' | 'manager'
  /** @deprecated Denormalized default-account pointer; use `activeAccountId`. */
  accountId?: string
  /** Pending-period account-name carrier (before an account exists). */
  accountName?: string
  /** Active business account (the `accountId` pointer validated against memberships). */
  activeAccountId?: string
  /** Role in the active business account (from memberships): 'owner' | 'admin' | null. */
  activeRole?: 'owner' | 'admin' | null
  /** Platform (Galiluz-management) role (from memberships): 'super_admin' | 'viewer' | null. */
  platformRole?: 'super_admin' | 'viewer' | null
  /** Per-publisher preference flags (raw, stored); resolve with getPublisherPreferences(). */
  preferences?: Record<string, unknown>
}

export interface AuthOptions {
  /** @deprecated alias of `requireSuperAdmin`. Throws 403 unless the user is a platform super_admin. */
  requireManager?: boolean
  /** Throws 403 unless the user is a platform super_admin. */
  requireSuperAdmin?: boolean
  /** Throws 403 unless the user is platform staff (super_admin or viewer) — for admin READ routes. */
  requirePlatformStaff?: boolean
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
      { projection: { _id: 1, waId: 1, fullName: 1, publishingAs: 1, accountName: 1, type: 1, status: 1, accountId: 1, preferences: 1 } },
    )

    if (!doc || doc.status !== 'approved') {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'Invalid or expired token' })
    }

    // Roles are read FRESH from memberships every request (never cache a privilege — a stale
    // role cache is the classic multi-tenant escalation bug). Platform roles (super_admin/viewer)
    // and business roles (owner/admin) use disjoint names, so we classify by role name.
    const publisherId = doc._id.toString()
    const membershipsCol = db.collection(config.mongodbCollectionMemberships || 'memberships')
    const memberships = await membershipsCol
      .find({ publisherId }, { projection: { accountId: 1, role: 1 } })
      .toArray()
    const platformRole = (memberships.find((m) => m.role === 'super_admin' || m.role === 'viewer')?.role
      || null) as 'super_admin' | 'viewer' | null
    const businessMemberships = memberships.filter((m) => m.role === 'owner' || m.role === 'admin')
    // Active business account = the denormalized pointer when it has a live membership, else the
    // first business membership, else the pointer itself (preserves today's behavior pre-backfill).
    const pointer = doc.accountId || undefined
    const activeMembership = businessMemberships.find((m) => m.accountId === pointer) || businessMemberships[0]
    const activeAccountId = activeMembership?.accountId || pointer
    const activeRole = (activeMembership?.role || null) as 'owner' | 'admin' | null

    const session: PublisherSession = {
      publisherId,
      waId: doc.waId,
      fullName: doc.fullName || '',
      publishingAs: doc.publishingAs || '',
      type: doc.type === 'manager' ? 'manager' : 'publisher',
      accountId: doc.accountId || undefined,
      accountName: doc.accountName || undefined,
      activeAccountId,
      activeRole,
      platformRole,
      preferences: doc.preferences || {},
    }

    // During the rollout the legacy `type==='manager'` still counts as super_admin (the platform
    // membership is created in the Migrate phase). All gates resolve through the authz helpers.
    const effectiveSuperAdmin = isSuperAdmin(platformRole) || session.type === 'manager'
    const effectivePlatformStaff = isPlatformStaff(platformRole) || session.type === 'manager'

    if ((options.requireManager || options.requireSuperAdmin) && !effectiveSuperAdmin) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'manager_only' })
    }
    if (options.requirePlatformStaff && !effectivePlatformStaff) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'platform_staff_only' })
    }

    return session
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    console.error('[Auth] requirePublisherAuth error:', err instanceof Error ? err.message : String(err))
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
  }
}

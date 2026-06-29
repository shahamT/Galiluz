import { createHmac } from 'node:crypto'
import type { H3Event } from 'h3'
import { getMongoConnection } from '~/server/utils/mongodb'
import { resolvePublisherRoles } from '~/server/utils/accountScope'

export interface PublisherSession {
  publisherId: string
  waId: string
  fullName: string
  /** Account display title (accounts.title); empty for web publishers — resolve via resolveAccountTitle. */
  publishingAs: string
  /** Pending-period account-name carrier (before an account exists). */
  accountName?: string
  /** Active business account (the `accountId` pointer validated against memberships). */
  activeAccountId?: string
  /** Role in the active business account (from memberships): 'owner' | 'admin' | null. */
  activeRole?: 'owner' | 'admin' | null
  /** Platform (Galiluz-management) role (from memberships): 'platform_owner' | 'super_admin' | 'viewer' | null. */
  platformRole?: 'platform_owner' | 'super_admin' | 'viewer' | null
  /** Platform super-admin — use for per-event "act on any event" checks. (Owner is a superset → true.) */
  isSuperAdmin: boolean
  /** Platform staff (owner / super_admin / viewer) — may read the admin portal. */
  isPlatformStaff: boolean
  /** The single platform owner — may manage platform staff + the platform account's settings. */
  isPlatformOwner: boolean
  /** Per-publisher preference flags (raw, stored); resolve with getPublisherPreferences(). */
  preferences?: Record<string, unknown>
}

export interface AuthOptions {
  /** Throws 403 unless the user is the platform owner (message `platform_owner_only`) — staff/platform-account governance. */
  requirePlatformOwner?: boolean
  /** Throws 403 unless the user is a platform super_admin or owner (message `manager_only`). */
  requireSuperAdmin?: boolean
  /** Throws 403 unless the user is platform staff (owner / super_admin / viewer) — for admin READ routes. */
  requirePlatformStaff?: boolean
}

/**
 * Validates the Bearer token from the Authorization header.
 * Throws 401 if missing, invalid, or expired.
 * Throws 403 on a failed role gate (requireSuperAdmin / requirePlatformStaff).
 * Returns publisher session info on success, with roles derived FRESH from memberships.
 *
 * Usage:
 *   const session = await requirePublisherAuth(event)                            // any authenticated user
 *   const session = await requirePublisherAuth(event, { requireSuperAdmin: true })   // platform super-admin
 *   const session = await requirePublisherAuth(event, { requirePlatformStaff: true }) // admin READ routes (super_admin|viewer)
 *
 * For resource ownership use the tenant key (see ownsEventForSession) and the super-admin bypass:
 *   if (!session.isSuperAdmin && !ownsEventForSession(session, doc.event))
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
      { projection: { _id: 1, waId: 1, fullName: 1, publishingAs: 1, accountName: 1, status: 1, isActive: 1, accountId: 1, preferences: 1 } },
    )

    // Deactivated publishers (isActive === false) keep their data but cannot use a session.
    if (!doc || doc.status !== 'approved' || doc.isActive === false) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'Invalid or expired token' })
    }

    // Roles are read FRESH from memberships every request (never cache a privilege — a stale role
    // cache is the classic multi-tenant escalation bug). resolvePublisherRoles derives platformRole,
    // the active business account/role, and the super_admin/platform-staff gates. `accountId` is the
    // default-active-account pointer used to pick the active membership.
    const publisherId = doc._id.toString()
    const roles = await resolvePublisherRoles({ publisherId, accountId: doc.accountId })

    const session: PublisherSession = {
      publisherId,
      waId: doc.waId,
      fullName: doc.fullName || '',
      publishingAs: doc.publishingAs || '',
      accountName: doc.accountName || undefined,
      activeAccountId: roles.activeAccountId,
      activeRole: roles.activeRole,
      platformRole: roles.platformRole,
      isSuperAdmin: roles.isSuperAdmin,
      isPlatformStaff: roles.isPlatformStaff,
      isPlatformOwner: roles.isPlatformOwner,
      preferences: doc.preferences || {},
    }

    if (options.requirePlatformOwner && !session.isPlatformOwner) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'platform_owner_only' })
    }
    if (options.requireSuperAdmin && !session.isSuperAdmin) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'manager_only' })
    }
    if (options.requirePlatformStaff && !session.isPlatformStaff) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'platform_staff_only' })
    }

    return session
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    console.error('[Auth] requirePublisherAuth error:', err instanceof Error ? err.message : String(err))
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
  }
}

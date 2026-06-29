/**
 * Central authorization policy for the multi-tenant RBAC model: capabilities → roles.
 *
 * Two distinct PLANES, kept separate on purpose:
 *  - PLATFORM (Galiluz management; cross-tenant; every use must be audited): super_admin | viewer.
 *  - ACCOUNT (scoped to the caller's ACTIVE business account): owner | admin.
 *
 * The TENANT BOUNDARY (does the user belong to the account that owns the resource) is checked
 * by the caller BEFORE consulting an account-plane capability — this module only answers
 * "does this set of roles grant this capability". Pure + dependency-free → unit-testable.
 */
export type PlatformRole = 'platform_owner' | 'super_admin' | 'viewer'
export type BusinessRole = 'owner' | 'admin'
export type Role = PlatformRole | BusinessRole

export const CAPABILITIES = {
  // ── Platform plane (cross-tenant, audited) ──
  VIEW_ADMIN: 'VIEW_ADMIN',                 // read the admin portal (dashboards, all events, stats)
  MANAGE_EVENTS_ANY: 'MANAGE_EVENTS_ANY',   // edit/delete/status any account's event
  TRANSFER_EVENT: 'TRANSFER_EVENT',         // reassign an event to another publisher/account
  MANAGE_BROADCASTS: 'MANAGE_BROADCASTS',
  MANAGE_CRAWLER: 'MANAGE_CRAWLER',
  APPROVE_PUBLISHERS: 'APPROVE_PUBLISHERS',
  MANAGE_ACCOUNTS: 'MANAGE_ACCOUNTS',       // manage business accounts + their publishers/account-roles (staff + owner)
  MANAGE_PLATFORM: 'MANAGE_PLATFORM',       // manage platform STAFF + the platform account's settings (owner ONLY)
  // ── Account plane (scoped to the active business account) ──
  MANAGE_EVENTS: 'MANAGE_EVENTS',           // create/edit/delete the active account's own events
} as const

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES]

// Galiluz staff: everything operational across business accounts, but NOT platform governance
// (staff roles / platform-account settings) — that's owner-only via MANAGE_PLATFORM.
const SUPER_ADMIN_CAPS: Capability[] = [
  CAPABILITIES.VIEW_ADMIN,
  CAPABILITIES.MANAGE_EVENTS_ANY,
  CAPABILITIES.TRANSFER_EVENT,
  CAPABILITIES.MANAGE_BROADCASTS,
  CAPABILITIES.MANAGE_CRAWLER,
  CAPABILITIES.APPROVE_PUBLISHERS,
  CAPABILITIES.MANAGE_ACCOUNTS,
]

// The single platform owner: every staff capability PLUS platform governance.
// Some owner-only governance is enforced directly at the route gate (requirePlatformOwner) rather than
// via a dedicated capability: APPROVERS CONFIG (server/api/admin/settings/approvers/*) and the LIFECYCLE
// (deactivate/delete) of a platform staffer (admin/publisher/[id]/active|delete). Crawler + broadcasts
// stay super_admin (in SUPER_ADMIN_CAPS above).
const PLATFORM_OWNER_CAPS: Capability[] = [...SUPER_ADMIN_CAPS, CAPABILITIES.MANAGE_PLATFORM]

/** Capability grant per role. Adding a role (e.g. 'moderator') = a new entry here, not new call sites. */
export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  platform_owner: PLATFORM_OWNER_CAPS,
  super_admin: SUPER_ADMIN_CAPS,
  viewer: [CAPABILITIES.VIEW_ADMIN],
  owner: [CAPABILITIES.MANAGE_EVENTS],
  admin: [CAPABILITIES.MANAGE_EVENTS],
}

export function roleHasCapability(role: Role | null | undefined, capability: Capability): boolean {
  if (!role) return false
  const caps = ROLE_CAPABILITIES[role]
  return Array.isArray(caps) && caps.includes(capability)
}

/**
 * Does the caller hold `capability`, considering BOTH their platform role and their active
 * business role? (Platform and account capability sets are disjoint, so the union is exact.)
 */
export function hasCapability(
  roles: { platformRole?: Role | null; activeRole?: Role | null },
  capability: Capability,
): boolean {
  return roleHasCapability(roles.platformRole, capability) || roleHasCapability(roles.activeRole, capability)
}

/** The single platform owner — full platform governance (manage staff + platform-account settings). */
export function isPlatformOwner(platformRole: Role | null | undefined): boolean {
  return platformRole === 'platform_owner'
}

/** Super-admin powers. The owner is a strict superset, so it counts here too. */
export function isSuperAdmin(platformRole: Role | null | undefined): boolean {
  return platformRole === 'super_admin' || platformRole === 'platform_owner'
}

/** Any Galiluz-management role (owner / super_admin / viewer) → may read the admin portal. */
export function isPlatformStaff(platformRole: Role | null | undefined): boolean {
  return platformRole === 'platform_owner' || platformRole === 'super_admin' || platformRole === 'viewer'
}

/** A membership row, reduced to what role resolution needs. */
export interface MembershipRow {
  accountId: string
  role: string
  createdAt?: Date | string | null
}

/** The roles + active-account a session carries, derived fresh from membership rows. */
export interface ResolvedRoles {
  platformRole: PlatformRole | null
  /** Active business account: the pointer when it has a live membership, else the resolver pick. */
  activeAccountId: string | undefined
  activeRole: BusinessRole | null
  /** Effective gates (derived purely from the platform membership). */
  isSuperAdmin: boolean
  isPlatformStaff: boolean
  isPlatformOwner: boolean
}

const BUSINESS_ROLE_PRIORITY: Record<string, number> = { owner: 0, admin: 1 }

function membershipTime(v: Date | string | null | undefined): number {
  if (v instanceof Date) return v.getTime()
  const parsed = Date.parse(String(v ?? ''))
  return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * Derive a publisher's effective roles from their membership rows (pure; no DB) — `memberships`
 * is the single source of truth for roles.
 * - `platformRole`: the role of their platform-account membership (super_admin/viewer), else null.
 * - `activeAccountId`/`activeRole`: the business membership matching `pointer`
 *   (`publishers.accountId`, the default-active-account pointer) when present; otherwise the
 *   deterministic pick — highest priority (owner before admin), then oldest `createdAt`. Falls
 *   back to the pointer itself when there is no business membership (staff-only → undefined).
 *
 * Disjoint role-name namespaces (super_admin/viewer vs owner/admin) let us classify platform vs
 * business membership without joining `account.kind`.
 */
export function deriveActiveRoles(memberships: MembershipRow[], pointer: string | undefined): ResolvedRoles {
  const platformRole = (memberships.find((m) => m.role === 'platform_owner' || m.role === 'super_admin' || m.role === 'viewer')?.role
    || null) as PlatformRole | null

  const business = memberships.filter((m) => m.role === 'owner' || m.role === 'admin')
  const byPointer = pointer ? business.find((m) => m.accountId === pointer) : undefined
  const best = [...business].sort((a, b) => {
    const pr = (BUSINESS_ROLE_PRIORITY[a.role] ?? 9) - (BUSINESS_ROLE_PRIORITY[b.role] ?? 9)
    return pr !== 0 ? pr : membershipTime(a.createdAt) - membershipTime(b.createdAt)
  })[0]
  const active = byPointer || best

  return {
    platformRole,
    activeAccountId: active?.accountId || pointer,
    activeRole: (active?.role || null) as BusinessRole | null,
    isSuperAdmin: isSuperAdmin(platformRole),
    isPlatformStaff: isPlatformStaff(platformRole),
    isPlatformOwner: isPlatformOwner(platformRole),
  }
}

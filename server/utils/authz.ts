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
export type PlatformRole = 'super_admin' | 'viewer'
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
  MANAGE_STAFF: 'MANAGE_STAFF',             // add/remove Galiluz staff + assign platform roles
  // ── Account plane (scoped to the active business account) ──
  MANAGE_EVENTS: 'MANAGE_EVENTS',           // create/edit/delete the active account's own events
} as const

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES]

const SUPER_ADMIN_CAPS: Capability[] = [
  CAPABILITIES.VIEW_ADMIN,
  CAPABILITIES.MANAGE_EVENTS_ANY,
  CAPABILITIES.TRANSFER_EVENT,
  CAPABILITIES.MANAGE_BROADCASTS,
  CAPABILITIES.MANAGE_CRAWLER,
  CAPABILITIES.APPROVE_PUBLISHERS,
  CAPABILITIES.MANAGE_STAFF,
]

/** Capability grant per role. Adding a role (e.g. 'moderator') = a new entry here, not new call sites. */
export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
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

export function isSuperAdmin(platformRole: Role | null | undefined): boolean {
  return platformRole === 'super_admin'
}

/** Any Galiluz-management role (super_admin or viewer) → may read the admin portal. */
export function isPlatformStaff(platformRole: Role | null | undefined): boolean {
  return platformRole === 'super_admin' || platformRole === 'viewer'
}

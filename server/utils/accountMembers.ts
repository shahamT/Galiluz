/**
 * Pure rules for editing an account's membership (roles) from the admin portal. No DB — unit-testable.
 *
 * Two planes (mirrors authz.ts):
 *  - business account: EXACTLY ONE owner. A member is added as `admin` only; ownership is assigned
 *    solely by PROMOTING an admin to owner, which transfers it — the previous owner is auto-demoted
 *    to admin (returned as `transferFrom`). The owner can't be demoted or removed directly.
 *  - platform account: settable roles super_admin|viewer; the single platform_owner is IMMUTABLE here
 *    (it's the founder, set by migration — never demoted/removed via the UI).
 */
export type AccountKind = 'business' | 'platform'
export interface MemberRow { publisherId: string; role: string }
export interface MemberChange { action: 'setRole' | 'add' | 'remove'; publisherId: string; role?: string }
export type MemberChangeResult =
  | { ok: true; nextRole?: string; transferFrom?: string }
  | { ok: false; reason: string }

export const BUSINESS_EDIT_ROLES = ['owner', 'admin'] as const   // roles a member can hold
export const BUSINESS_ADD_ROLES = ['admin'] as const             // owner is assigned only by promotion (transfer)
export const PLATFORM_ROLES = ['super_admin', 'viewer'] as const // platform_owner is immutable

/** Roles selectable when CHANGING an existing member's role. */
export function settableRolesForKind(kind: AccountKind): readonly string[] {
  return kind === 'platform' ? PLATFORM_ROLES : BUSINESS_EDIT_ROLES
}
/** Roles selectable when ADDING a new member (business can't be added as owner). */
export function addableRolesForKind(kind: AccountKind): readonly string[] {
  return kind === 'platform' ? PLATFORM_ROLES : BUSINESS_ADD_ROLES
}

export function validateMemberChange(kind: AccountKind, members: MemberRow[], change: MemberChange): MemberChangeResult {
  const { action, publisherId, role } = change
  if (!publisherId) return { ok: false, reason: 'publisherId_required' }
  const existing = members.find((m) => m.publisherId === publisherId)

  if (kind === 'platform') {
    if (existing?.role === 'platform_owner' && action !== 'add') return { ok: false, reason: 'cannot_modify_platform_owner' }
    if (action === 'add') {
      if (existing) return { ok: false, reason: 'already_member' }
      if (!role || !PLATFORM_ROLES.includes(role as never)) return { ok: false, reason: 'invalid_role' }
      return { ok: true, nextRole: role }
    }
    if (action === 'setRole') {
      if (!existing) return { ok: false, reason: 'not_a_member' }
      if (!role || !PLATFORM_ROLES.includes(role as never)) return { ok: false, reason: 'invalid_role' }
      return { ok: true, nextRole: role }
    }
    if (!existing) return { ok: false, reason: 'not_a_member' }
    return { ok: true }
  }

  // ── business: exactly one owner; ownership changes only by transfer ──
  const currentOwner = members.find((m) => m.role === 'owner')

  if (action === 'add') {
    if (existing) return { ok: false, reason: 'already_member' }
    if (role !== 'admin') return { ok: false, reason: 'invalid_role' } // can't add as owner
    return { ok: true, nextRole: 'admin' }
  }

  if (action === 'setRole') {
    if (!existing) return { ok: false, reason: 'not_a_member' }
    if (role === 'owner') {
      if (existing.role === 'owner') return { ok: true, nextRole: 'owner' } // no-op
      const transferFrom = currentOwner && currentOwner.publisherId !== publisherId ? currentOwner.publisherId : undefined
      return { ok: true, nextRole: 'owner', transferFrom }
    }
    if (role === 'admin') {
      if (existing.role === 'owner') return { ok: false, reason: 'transfer_owner_instead' } // demote only via promoting another
      return { ok: true, nextRole: 'admin' }
    }
    return { ok: false, reason: 'invalid_role' }
  }

  // remove
  if (!existing) return { ok: false, reason: 'not_a_member' }
  if (existing.role === 'owner') return { ok: false, reason: 'cannot_remove_owner' }
  return { ok: true }
}

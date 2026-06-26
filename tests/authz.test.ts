import { describe, it, expect } from 'vitest'
import {
  CAPABILITIES,
  ROLE_CAPABILITIES,
  roleHasCapability,
  hasCapability,
  isSuperAdmin,
  isPlatformStaff,
  deriveActiveRoles,
} from '~/server/utils/authz'

describe('ROLE_CAPABILITIES', () => {
  it('super_admin holds every platform capability (and not the account-only one is irrelevant)', () => {
    for (const cap of [
      CAPABILITIES.VIEW_ADMIN, CAPABILITIES.MANAGE_EVENTS_ANY, CAPABILITIES.TRANSFER_EVENT,
      CAPABILITIES.MANAGE_BROADCASTS, CAPABILITIES.MANAGE_CRAWLER, CAPABILITIES.APPROVE_PUBLISHERS,
      CAPABILITIES.MANAGE_STAFF,
    ]) {
      expect(roleHasCapability('super_admin', cap)).toBe(true)
    }
  })

  it('viewer is read-only admin: VIEW_ADMIN only, NO mutations', () => {
    expect(roleHasCapability('viewer', CAPABILITIES.VIEW_ADMIN)).toBe(true)
    for (const cap of [
      CAPABILITIES.MANAGE_EVENTS_ANY, CAPABILITIES.TRANSFER_EVENT, CAPABILITIES.MANAGE_BROADCASTS,
      CAPABILITIES.MANAGE_CRAWLER, CAPABILITIES.APPROVE_PUBLISHERS, CAPABILITIES.MANAGE_STAFF,
    ]) {
      expect(roleHasCapability('viewer', cap)).toBe(false)
    }
  })

  it('business owner/admin manage their own events but hold NO platform capability', () => {
    for (const role of ['owner', 'admin'] as const) {
      expect(roleHasCapability(role, CAPABILITIES.MANAGE_EVENTS)).toBe(true)
      expect(roleHasCapability(role, CAPABILITIES.VIEW_ADMIN)).toBe(false)
      expect(roleHasCapability(role, CAPABILITIES.MANAGE_EVENTS_ANY)).toBe(false)
      expect(roleHasCapability(role, CAPABILITIES.MANAGE_BROADCASTS)).toBe(false)
    }
  })

  it('no role / unknown role grants nothing', () => {
    expect(roleHasCapability(null, CAPABILITIES.VIEW_ADMIN)).toBe(false)
    expect(roleHasCapability(undefined, CAPABILITIES.MANAGE_EVENTS)).toBe(false)
    // @ts-expect-error — defensive: an unknown role string grants nothing
    expect(roleHasCapability('moderator', CAPABILITIES.VIEW_ADMIN)).toBe(false)
  })

  it('every capability is granted by at least one role (no orphan capability)', () => {
    const granted = new Set(Object.values(ROLE_CAPABILITIES).flat())
    for (const cap of Object.values(CAPABILITIES)) expect(granted.has(cap)).toBe(true)
  })
})

describe('hasCapability (platform + active business role union)', () => {
  it('a publisher who is ALSO a super_admin gets both planes', () => {
    const roles = { platformRole: 'super_admin' as const, activeRole: 'owner' as const }
    expect(hasCapability(roles, CAPABILITIES.MANAGE_EVENTS)).toBe(true)        // from owner
    expect(hasCapability(roles, CAPABILITIES.MANAGE_BROADCASTS)).toBe(true)     // from super_admin
  })

  it('a plain business owner has account caps but no platform caps', () => {
    const roles = { platformRole: null, activeRole: 'owner' as const }
    expect(hasCapability(roles, CAPABILITIES.MANAGE_EVENTS)).toBe(true)
    expect(hasCapability(roles, CAPABILITIES.VIEW_ADMIN)).toBe(false)
  })

  it('a viewer-only staffer (no business account) can read admin but not mutate', () => {
    const roles = { platformRole: 'viewer' as const, activeRole: null }
    expect(hasCapability(roles, CAPABILITIES.VIEW_ADMIN)).toBe(true)
    expect(hasCapability(roles, CAPABILITIES.MANAGE_EVENTS_ANY)).toBe(false)
    expect(hasCapability(roles, CAPABILITIES.MANAGE_EVENTS)).toBe(false)
  })
})

describe('isSuperAdmin / isPlatformStaff', () => {
  it('isSuperAdmin only for super_admin', () => {
    expect(isSuperAdmin('super_admin')).toBe(true)
    expect(isSuperAdmin('viewer')).toBe(false)
    expect(isSuperAdmin(null)).toBe(false)
  })
  it('isPlatformStaff for super_admin and viewer', () => {
    expect(isPlatformStaff('super_admin')).toBe(true)
    expect(isPlatformStaff('viewer')).toBe(true)
    expect(isPlatformStaff(null)).toBe(false)
    expect(isPlatformStaff('owner')).toBe(false)
  })
})

describe('deriveActiveRoles (memberships → session roles)', () => {
  it('single business owner (the common case): active account = pointer, owner role, no platform', () => {
    const r = deriveActiveRoles([{ accountId: 'A', role: 'owner' }], 'A')
    expect(r.activeAccountId).toBe('A')
    expect(r.activeRole).toBe('owner')
    expect(r.platformRole).toBe(null)
    expect(r.isSuperAdmin).toBe(false)
    expect(r.isPlatformStaff).toBe(false)
  })

  it('pointer wins over other business memberships', () => {
    const r = deriveActiveRoles(
      [{ accountId: 'A', role: 'admin' }, { accountId: 'B', role: 'owner' }],
      'B',
    )
    expect(r.activeAccountId).toBe('B')
    expect(r.activeRole).toBe('owner')
  })

  it('no pointer match → owner before admin, then oldest createdAt', () => {
    const r = deriveActiveRoles(
      [
        { accountId: 'A', role: 'admin', createdAt: '2024-01-01' },
        { accountId: 'B', role: 'owner', createdAt: '2024-03-01' },
        { accountId: 'C', role: 'owner', createdAt: '2024-02-01' },
      ],
      undefined,
    )
    // owner beats admin; among owners, the older (C, Feb) beats B (Mar)
    expect(r.activeAccountId).toBe('C')
    expect(r.activeRole).toBe('owner')
  })

  it('a publisher who is ALSO platform staff carries both planes', () => {
    const r = deriveActiveRoles(
      [{ accountId: 'A', role: 'owner' }, { accountId: 'PLATFORM', role: 'super_admin' }],
      'A',
    )
    expect(r.activeAccountId).toBe('A')
    expect(r.activeRole).toBe('owner')
    expect(r.platformRole).toBe('super_admin')
    expect(r.isSuperAdmin).toBe(true)
    expect(r.isPlatformStaff).toBe(true)
  })

  it('viewer-only staffer (no business membership): platform role set, active account = pointer/undefined', () => {
    const r = deriveActiveRoles([{ accountId: 'PLATFORM', role: 'viewer' }], undefined)
    expect(r.platformRole).toBe('viewer')
    expect(r.activeAccountId).toBe(undefined)
    expect(r.activeRole).toBe(null)
    expect(r.isSuperAdmin).toBe(false)
    expect(r.isPlatformStaff).toBe(true)
  })

  it('rollout alias: legacy type==="manager" with NO platform membership still counts as super_admin', () => {
    const r = deriveActiveRoles([{ accountId: 'A', role: 'owner' }], 'A', 'manager')
    expect(r.platformRole).toBe(null)       // no membership yet (pre-migrate)
    expect(r.isSuperAdmin).toBe(true)        // but the alias gates it as super_admin
    expect(r.isPlatformStaff).toBe(true)
  })

  it('empty memberships with a pointer → falls back to the pointer (pre-backfill behavior)', () => {
    const r = deriveActiveRoles([], 'A')
    expect(r.activeAccountId).toBe('A')
    expect(r.activeRole).toBe(null)
    expect(r.platformRole).toBe(null)
    expect(r.isSuperAdmin).toBe(false)
  })
})

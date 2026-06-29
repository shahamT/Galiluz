import { describe, it, expect } from 'vitest'
import { validateMemberChange, settableRolesForKind, addableRolesForKind } from '~/server/utils/accountMembers'

describe('role lists', () => {
  it('edit roles: business owner/admin; platform super_admin/viewer', () => {
    expect([...settableRolesForKind('business')]).toEqual(['owner', 'admin'])
    expect([...settableRolesForKind('platform')]).toEqual(['super_admin', 'viewer'])
  })
  it('add roles: business admin-only (no owner); platform super_admin/viewer', () => {
    expect([...addableRolesForKind('business')]).toEqual(['admin'])
    expect([...addableRolesForKind('platform')]).toEqual(['super_admin', 'viewer'])
  })
})

describe('validateMemberChange — business (exactly one owner, transfer on promote)', () => {
  const members = [
    { publisherId: 'A', role: 'owner' },
    { publisherId: 'B', role: 'admin' },
  ]

  it('a member can only be ADDED as admin (never owner)', () => {
    expect(validateMemberChange('business', members, { action: 'add', publisherId: 'X', role: 'admin' })).toEqual({ ok: true, nextRole: 'admin' })
    expect(validateMemberChange('business', members, { action: 'add', publisherId: 'X', role: 'owner' })).toEqual({ ok: false, reason: 'invalid_role' })
  })

  it('promoting an admin to owner TRANSFERS ownership (old owner demoted)', () => {
    expect(validateMemberChange('business', members, { action: 'setRole', publisherId: 'B', role: 'owner' }))
      .toEqual({ ok: true, nextRole: 'owner', transferFrom: 'A' })
  })

  it('promoting to owner with no current owner just assigns it (no transfer)', () => {
    const noOwner = [{ publisherId: 'B', role: 'admin' }]
    expect(validateMemberChange('business', noOwner, { action: 'setRole', publisherId: 'B', role: 'owner' }))
      .toEqual({ ok: true, nextRole: 'owner' })
  })

  it('setting the current owner to owner again is a no-op', () => {
    expect(validateMemberChange('business', members, { action: 'setRole', publisherId: 'A', role: 'owner' })).toEqual({ ok: true, nextRole: 'owner' })
  })

  it('the owner cannot be demoted directly (must promote another instead)', () => {
    expect(validateMemberChange('business', members, { action: 'setRole', publisherId: 'A', role: 'admin' }))
      .toEqual({ ok: false, reason: 'transfer_owner_instead' })
  })

  it('the owner cannot be removed; an admin can', () => {
    expect(validateMemberChange('business', members, { action: 'remove', publisherId: 'A' })).toEqual({ ok: false, reason: 'cannot_remove_owner' })
    expect(validateMemberChange('business', members, { action: 'remove', publisherId: 'B' })).toEqual({ ok: true })
  })

  it('adding an existing member / acting on a non-member fails', () => {
    expect(validateMemberChange('business', members, { action: 'add', publisherId: 'A', role: 'admin' })).toEqual({ ok: false, reason: 'already_member' })
    expect(validateMemberChange('business', members, { action: 'setRole', publisherId: 'Z', role: 'admin' })).toEqual({ ok: false, reason: 'not_a_member' })
  })
})

describe('validateMemberChange — platform (owner immutable; staff = super_admin/viewer)', () => {
  const members = [
    { publisherId: 'OWNER', role: 'platform_owner' },
    { publisherId: 'S', role: 'super_admin' },
    { publisherId: 'V', role: 'viewer' },
  ]

  it('the platform_owner cannot be demoted or removed', () => {
    expect(validateMemberChange('platform', members, { action: 'setRole', publisherId: 'OWNER', role: 'super_admin' })).toEqual({ ok: false, reason: 'cannot_modify_platform_owner' })
    expect(validateMemberChange('platform', members, { action: 'remove', publisherId: 'OWNER' })).toEqual({ ok: false, reason: 'cannot_modify_platform_owner' })
  })

  it('staff roles toggle between super_admin and viewer', () => {
    expect(validateMemberChange('platform', members, { action: 'setRole', publisherId: 'V', role: 'super_admin' })).toEqual({ ok: true, nextRole: 'super_admin' })
    expect(validateMemberChange('platform', members, { action: 'setRole', publisherId: 'S', role: 'viewer' })).toEqual({ ok: true, nextRole: 'viewer' })
  })

  it('cannot set a platform member to platform_owner or a business role via the UI', () => {
    expect(validateMemberChange('platform', members, { action: 'setRole', publisherId: 'S', role: 'platform_owner' })).toEqual({ ok: false, reason: 'invalid_role' })
    expect(validateMemberChange('platform', members, { action: 'setRole', publisherId: 'S', role: 'owner' })).toEqual({ ok: false, reason: 'invalid_role' })
  })

  it('removing a staff member is fine', () => {
    expect(validateMemberChange('platform', members, { action: 'remove', publisherId: 'S' })).toEqual({ ok: true })
  })
})

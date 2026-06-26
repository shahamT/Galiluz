import { describe, it, expect } from 'vitest'
import { getAccountPublisherIds, ensureAccountForPublisher } from '~/server/utils/accountScope'

// These cover the branches that return before any DB / runtime-config access:
// the graceful fallback (scoping degrades to per-publisher) and the idempotent skip.
// The create path needs a live Mongo connection and is exercised by the migration
// script + manual verification, not here.

describe('getAccountPublisherIds', () => {
  it('falls back to the caller\'s own publisherId when there is no active account (platform-only staff)', async () => {
    const session = { publisherId: 'pub-1', waId: '972500000000', fullName: '', publishingAs: '', isSuperAdmin: false, isPlatformStaff: false }
    const ids = await getAccountPublisherIds(session)
    expect(ids).toEqual(['pub-1'])
  })
})

describe('ensureAccountForPublisher', () => {
  it('returns the existing accountId without creating a new account (idempotent)', async () => {
    const accountId = await ensureAccountForPublisher({ _id: { toString: () => 'p1' }, accountId: 'acc-123' })
    expect(accountId).toBe('acc-123')
  })
})

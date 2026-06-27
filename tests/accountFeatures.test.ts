import { describe, it, expect } from 'vitest'
import { getAccountFeatures, resolveFeatures } from '~/server/utils/accountFeatures'

// getAccountFeatures: cover the branches that return before any DB / runtime-config
// access (super_admin bypass + the fail-closed fallbacks). The DB lookup path is
// exercised by resolveFeatures below (the pure merge) + manual verification.
describe('getAccountFeatures', () => {
  it('platform super_admin bypasses gating — every feature enabled, no DB lookup', async () => {
    const features = await getAccountFeatures({ activeAccountId: 'acc-1', platformRole: 'super_admin' })
    expect(features).toEqual({ globalStats: true, perEventStats: true })
  })

  it('a viewer does NOT bypass — features fall through to the account (fail-closed when id invalid)', async () => {
    const features = await getAccountFeatures({ activeAccountId: 'not-an-objectid', platformRole: 'viewer' })
    expect(features).toEqual({ globalStats: false, perEventStats: false })
  })

  it('fails closed to defaults (OFF) when there is no active account', async () => {
    const features = await getAccountFeatures({})
    expect(features).toEqual({ globalStats: false, perEventStats: false })
  })

  it('fails closed to defaults (OFF) when activeAccountId is not a valid ObjectId', async () => {
    const features = await getAccountFeatures({ activeAccountId: 'not-an-objectid' })
    expect(features).toEqual({ globalStats: false, perEventStats: false })
  })
})

// resolveFeatures: the pure merge — registry defaults overlaid with the stored map,
// whitelisted to known keys and boolean values.
describe('resolveFeatures', () => {
  it('returns all defaults (OFF) for an absent/empty features object', () => {
    expect(resolveFeatures(undefined)).toEqual({ globalStats: false, perEventStats: false })
    expect(resolveFeatures(null)).toEqual({ globalStats: false, perEventStats: false })
    expect(resolveFeatures({})).toEqual({ globalStats: false, perEventStats: false })
  })

  it('merges a partial features object over the defaults', () => {
    expect(resolveFeatures({ globalStats: true })).toEqual({ globalStats: true, perEventStats: false })
    expect(resolveFeatures({ perEventStats: true })).toEqual({ globalStats: false, perEventStats: true })
  })

  it('ignores non-boolean values, falling back to the default for that key', () => {
    // truthy-but-not-boolean must NOT enable a feature
    expect(resolveFeatures({ globalStats: 'true', perEventStats: 1 })).toEqual({ globalStats: false, perEventStats: false })
  })

  it('ignores unknown keys (whitelist) and never leaks them into the result', () => {
    const out = resolveFeatures({ globalStats: true, somethingElse: true })
    expect(out).toEqual({ globalStats: true, perEventStats: false })
    expect(out).not.toHaveProperty('somethingElse')
  })
})

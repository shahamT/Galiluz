import { describe, it, expect } from 'vitest'
import { getAccountFeatures, resolveFeatures } from '~/server/utils/accountFeatures'

// getAccountFeatures: cover the branches that return before any DB / runtime-config
// access (manager bypass + the fail-closed fallbacks). The DB lookup path is
// exercised by resolveFeatures below (the pure merge) + manual verification.
describe('getAccountFeatures', () => {
  it('managers bypass gating — every feature enabled, no DB lookup', async () => {
    const features = await getAccountFeatures({ accountId: 'acc-1', type: 'manager' })
    expect(features).toEqual({ globalStats: true, perEventStats: true })
  })

  it('fails closed to defaults (OFF) when the publisher has no account yet', async () => {
    const features = await getAccountFeatures({ type: 'publisher' })
    expect(features).toEqual({ globalStats: false, perEventStats: false })
  })

  it('fails closed to defaults (OFF) when accountId is not a valid ObjectId', async () => {
    const features = await getAccountFeatures({ accountId: 'not-an-objectid', type: 'publisher' })
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

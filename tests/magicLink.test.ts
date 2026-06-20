import { describe, it, expect } from 'vitest'
import { hashMagicToken } from '~/server/utils/magicLink'

// hashMagicToken is the pure HMAC used to store magic-link tokens hashed at rest.
// The consume path (DB lookup, single-use burn, session issuance) is exercised by
// manual verification; here we cover the hashing contract the consume path relies on.
describe('hashMagicToken', () => {
  it('is deterministic for the same token + secret', () => {
    expect(hashMagicToken('abc123', 's3cret')).toBe(hashMagicToken('abc123', 's3cret'))
  })

  it('produces a 64-char lowercase hex SHA-256 digest', () => {
    expect(hashMagicToken('abc123', 's3cret')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('differs for different tokens (so each link is distinguishable)', () => {
    expect(hashMagicToken('tokenA', 's3cret')).not.toBe(hashMagicToken('tokenB', 's3cret'))
  })

  it('differs for different secrets (rotating the secret invalidates old hashes)', () => {
    expect(hashMagicToken('abc123', 'secret1')).not.toBe(hashMagicToken('abc123', 'secret2'))
  })

  it('tolerates an empty secret (dev parity with OTP login)', () => {
    expect(hashMagicToken('abc123', '')).toMatch(/^[0-9a-f]{64}$/)
  })
})

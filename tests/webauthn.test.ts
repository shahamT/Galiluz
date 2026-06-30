import { describe, it, expect } from 'vitest'
import { resolveRpConfig } from '~/server/utils/webauthn'

describe('resolveRpConfig (WebAuthn rpID/origin derivation)', () => {
  it('dev defaults to localhost:3000', () => {
    const r = resolveRpConfig({ isDev: true, siteUrl: 'https://galiluz.co.il' })
    expect(r.rpID).toBe('localhost')
    expect(r.origin).toBe('http://localhost:3000')
  })

  it('prod derives rpID + origin from siteUrl', () => {
    const r = resolveRpConfig({ isDev: false, siteUrl: 'https://galiluz.co.il' })
    expect(r.rpID).toBe('galiluz.co.il')
    expect(r.origin).toBe('https://galiluz.co.il')
  })

  it('extracts the bare host for rpID (ignores scheme/path)', () => {
    const r = resolveRpConfig({ isDev: false, siteUrl: 'https://www.galiluz.co.il/some/path' })
    expect(r.rpID).toBe('www.galiluz.co.il')
  })

  it('explicit overrides always win (even in dev)', () => {
    const r = resolveRpConfig({
      isDev: true,
      siteUrl: 'https://galiluz.co.il',
      rpIdOverride: 'staging.example.com',
      originOverride: 'https://staging.example.com',
    })
    expect(r.rpID).toBe('staging.example.com')
    expect(r.origin).toBe('https://staging.example.com')
  })

  it('falls back to the default domain when siteUrl is missing/invalid', () => {
    expect(resolveRpConfig({ isDev: false, siteUrl: '' }).rpID).toBe('galiluz.co.il')
  })
})

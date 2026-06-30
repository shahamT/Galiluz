import { describe, it, expect } from 'vitest'
import { toLocalIsraeliNumber, buildOtpSmsText } from '~/server/utils/pulseem'

describe('toLocalIsraeliNumber (waId → Pulseem local format)', () => {
  it('converts a 972 waId to a local 0-prefixed number', () => {
    expect(toLocalIsraeliNumber('972559896278')).toBe('0559896278')
  })
  it('leaves an already-local 0-number unchanged', () => {
    expect(toLocalIsraeliNumber('0559896278')).toBe('0559896278')
  })
  it('strips separators/plus before converting', () => {
    expect(toLocalIsraeliNumber('+972-55-989-6278')).toBe('0559896278')
  })
})

describe('buildOtpSmsText', () => {
  it('embeds the OTP code', () => {
    expect(buildOtpSmsText('123456')).toContain('123456')
  })
})

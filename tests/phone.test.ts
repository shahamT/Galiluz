import { describe, it, expect } from 'vitest'
import { normalizeIsraeliPhone } from '~/server/utils/israeliPhone'
import { resolveExposedContactPhone } from '~/server/utils/contactPhone'

describe('normalizeIsraeliPhone', () => {
  it('passes through an already-normalized 972XXXXXXXXX number', () => {
    expect(normalizeIsraeliPhone('972501234567')).toBe('972501234567')
  })

  it('converts a 0-prefixed mobile (05X, 10 digits)', () => {
    expect(normalizeIsraeliPhone('0501234567')).toBe('972501234567')
  })

  it('converts a bare mobile (5X, 9 digits)', () => {
    expect(normalizeIsraeliPhone('501234567')).toBe('972501234567')
  })

  it('strips separators / country-code formatting before normalizing', () => {
    expect(normalizeIsraeliPhone('050-123-4567')).toBe('972501234567')
    expect(normalizeIsraeliPhone('+972 50 123 4567')).toBe('972501234567')
  })

  it('returns null for anything that is not a valid Israeli number', () => {
    expect(normalizeIsraeliPhone('123')).toBeNull()
    expect(normalizeIsraeliPhone('abc')).toBeNull()
    expect(normalizeIsraeliPhone('')).toBeNull()
    expect(normalizeIsraeliPhone('0412345678')).toBeNull() // 04 landline, not handled
    expect(normalizeIsraeliPhone(null as unknown as string)).toBeNull()
  })
})

describe('resolveExposedContactPhone', () => {
  it('returns empty string when contact is hidden', () => {
    expect(resolveExposedContactPhone({ showContactPhone: false, customContactPhone: '972501234567', ownWaId: '972509999999' })).toBe('')
  })

  it('returns the custom number when one is set', () => {
    expect(resolveExposedContactPhone({ showContactPhone: true, customContactPhone: '972501234567', ownWaId: '972509999999' })).toBe('972501234567')
  })

  it('trims the custom number', () => {
    expect(resolveExposedContactPhone({ customContactPhone: '  972501234567  ', ownWaId: '972509999999' })).toBe('972501234567')
  })

  it('falls back to the publisher own waId when no custom number', () => {
    expect(resolveExposedContactPhone({ showContactPhone: true, customContactPhone: '', ownWaId: '972509999999' })).toBe('972509999999')
  })

  it('defaults to shown when showContactPhone is undefined', () => {
    expect(resolveExposedContactPhone({ ownWaId: '972509999999' })).toBe('972509999999')
  })

  it('returns empty string when there is no usable own waId', () => {
    expect(resolveExposedContactPhone({ showContactPhone: true })).toBe('')
  })
})

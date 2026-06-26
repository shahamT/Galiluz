import { describe, it, expect } from 'vitest'
import { extractNavLinksFromRaw } from '~/server/utils/navLinks'
import { extractDocumentId } from '~/server/utils/eventFirstOccurrence'

describe('extractNavLinksFromRaw', () => {
  it('extracts a Waze URL and leaves gmaps null when absent', () => {
    const r = extractNavLinksFromRaw('ניווט: https://waze.com/ul/abc123', undefined)
    expect(r.wazeNavLink).toBe('https://waze.com/ul/abc123')
    expect(r.gmapsNavLink).toBeNull()
  })

  it('matches Google Maps URL variants', () => {
    expect(extractNavLinksFromRaw(undefined, 'https://maps.app.goo.gl/xyz').gmapsNavLink).toBe('https://maps.app.goo.gl/xyz')
    expect(extractNavLinksFromRaw(undefined, 'see https://www.google.com/maps/place/foo here').gmapsNavLink)
      .toBe('https://www.google.com/maps/place/foo')
  })

  it('finds each provider in the combined text regardless of which field it sits in', () => {
    const r = extractNavLinksFromRaw('https://maps.google.com/?q=1', 'https://ul.waze.com/abc')
    expect(r.wazeNavLink).toBe('https://ul.waze.com/abc')
    expect(r.gmapsNavLink).toBe('https://maps.google.com/?q=1')
  })

  it('returns nulls when there are no matching URLs', () => {
    expect(extractNavLinksFromRaw('no link here', undefined)).toEqual({ wazeNavLink: null, gmapsNavLink: null })
    expect(extractNavLinksFromRaw(undefined, undefined)).toEqual({ wazeNavLink: null, gmapsNavLink: null })
  })
})

describe('extractDocumentId', () => {
  it('returns the id as-is when there is no occurrence suffix', () => {
    expect(extractDocumentId('507f1f77bcf86cd799439011')).toBe('507f1f77bcf86cd799439011')
  })

  it('strips the -<index> flat-event suffix', () => {
    expect(extractDocumentId('507f1f77bcf86cd799439011-2')).toBe('507f1f77bcf86cd799439011')
  })

  it('returns null for empty / blank / non-string input', () => {
    expect(extractDocumentId('')).toBeNull()
    expect(extractDocumentId('   ')).toBeNull()
    expect(extractDocumentId(null as unknown as string)).toBeNull()
  })
})

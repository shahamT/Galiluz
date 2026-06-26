import { describe, it, expect } from 'vitest'
import { transformEventForFrontend } from '~/server/utils/eventsTransform'
// @ts-expect-error — plain JS consts, no types
import { CITIES } from '~/consts/regions.const.js'

const [LISTED_ID, LISTED] = Object.entries(CITIES as Record<string, { title: string; region: string }>)[0]

function baseDoc(overrides: Record<string, unknown> = {}, eventOverrides: Record<string, unknown> = {}) {
  return {
    _id: 'evt-1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
    event: {
      Title: 'אירוע',
      categories: ['music'],
      mainCategory: 'music',
      occurrences: [{ date: '2026-07-03', startTime: '2026-07-03T07:00:00Z', hasTime: true }],
      location: { cityType: 'listed', city: LISTED_ID },
      ...eventOverrides,
    },
  }
}

describe('transformEventForFrontend', () => {
  it('returns null when the doc has no formatted event', () => {
    expect(transformEventForFrontend({ _id: 'x' })).toBeNull()
    expect(transformEventForFrontend({ _id: 'x', event: null })).toBeNull()
  })

  it('maps core fields (Title→title, id from _id)', () => {
    const r = transformEventForFrontend(baseDoc())!
    expect(r.id).toBe('evt-1')
    expect(r.title).toBe('אירוע')
    expect(r.categories).toEqual(['music'])
  })

  it('resolves a listed city to its Hebrew title + region', () => {
    const r = transformEventForFrontend(baseDoc())!
    expect((r.location as { city: string; region?: string }).city).toBe(LISTED.title)
    expect((r.location as { city: string; region?: string }).region).toBe(LISTED.region)
  })

  it('keeps a custom city raw and uses its stored region', () => {
    const r = transformEventForFrontend(baseDoc({}, { location: { cityType: 'custom', city: 'עיר בדיונית', region: 'golan' } }))!
    expect((r.location as { city: string; region?: string }).city).toBe('עיר בדיונית')
    expect((r.location as { city: string; region?: string }).region).toBe('golan')
  })

  it('self-heals a legacy doc (no cityType) when the stored city is a known CITIES id', () => {
    const r = transformEventForFrontend(baseDoc({}, { location: { city: LISTED_ID } }))!
    expect((r.location as { city: string; region?: string }).city).toBe(LISTED.title)
    expect((r.location as { city: string; region?: string }).region).toBe(LISTED.region)
  })

  it('applies sensible defaults (price null, multiDayEvent true, isActive)', () => {
    const r = transformEventForFrontend(baseDoc())!
    expect(r.price).toBeNull()
    expect(r.multiDayEvent).toBe(true)
    expect(r.isActive).toBe(true) // doc.isActive undefined → !== false
    const inactive = transformEventForFrontend(baseDoc({ isActive: false }, { multiDayEvent: false, price: 0 }))!
    expect(inactive.isActive).toBe(false)
    expect(inactive.multiDayEvent).toBe(false)
    expect(inactive.price).toBe(0)
  })

  it('derives an occurrence date from startTime when no explicit date', () => {
    const r = transformEventForFrontend(baseDoc({}, { occurrences: [{ startTime: '2026-07-03T10:00:00Z', hasTime: true }] }))!
    expect((r.occurrences as Array<{ date?: string }>)[0].date).toBe('2026-07-03')
  })

  it('exposes the resolved publisherPhone but NOT the private contact-control fields', () => {
    const r = transformEventForFrontend(baseDoc({}, {
      publisherPhone: '972501234567',
      showContactPhone: false,
      customContactPhone: '972509999999',
    }))!
    expect(r.publisherPhone).toBe('972501234567')
    expect('showContactPhone' in r).toBe(false)
    expect('customContactPhone' in r).toBe(false)
  })
})

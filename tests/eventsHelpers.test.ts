import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS module, no types
import {
  formatEventTime,
  formatEventPrice,
  formatEventLocation,
  formatEventLocationForChip,
  PRICE_UNKNOWN_TEXT,
} from '~/utils/events.helpers'
// @ts-expect-error — plain JS consts, no types
import { CITIES } from '~/consts/regions.const.js'

const [LISTED_ID, LISTED] = Object.entries(CITIES as Record<string, { title: string; region: string }>)[0]

describe('formatEventTime', () => {
  it('returns the all-day label when hasTime is false', () => {
    expect(formatEventTime({ hasTime: false })).toBe('כל היום')
  })

  it('returns a single Israel HH:MM when only a start time is present', () => {
    expect(formatEventTime({ hasTime: true, startTime: '2026-01-15T10:00:00Z' })).toBe('12:00')
  })

  it('returns a HH:MM-HH:MM range when start and end are present', () => {
    expect(formatEventTime({ hasTime: true, startTime: '2026-01-15T10:00:00Z', endTime: '2026-01-15T12:00:00Z' }))
      .toBe('12:00-14:00')
  })

  it('returns empty string when timed but missing startTime', () => {
    expect(formatEventTime({ hasTime: true })).toBe('')
  })
})

describe('formatEventPrice', () => {
  it('shows "unknown" for null/undefined price', () => {
    expect(formatEventPrice({ price: null })).toBe(PRICE_UNKNOWN_TEXT)
    expect(formatEventPrice({})).toBe(PRICE_UNKNOWN_TEXT)
  })

  it('shows "free" for 0', () => {
    expect(formatEventPrice({ price: 0 })).toBe('חינם')
  })

  it('shows "N ₪" for a positive price', () => {
    expect(formatEventPrice({ price: 50 })).toBe('50 ₪')
  })
})

describe('formatEventLocation', () => {
  it('joins venue, address and resolved city', () => {
    const out = formatEventLocation({ location: { locationName: 'האולם', addressLine1: 'הרחוב 1', city: LISTED_ID } })
    expect(out).toBe(`האולם, הרחוב 1, ${LISTED.title}`)
  })

  it('returns empty string when there is no location', () => {
    expect(formatEventLocation({})).toBe('')
  })
})

describe('formatEventLocationForChip', () => {
  it('combines name and city', () => {
    expect(formatEventLocationForChip({ location: { locationName: 'האולם', city: LISTED_ID } })).toBe(`האולם - ${LISTED.title}`)
  })

  it('falls back to city only, then name only, then unknown', () => {
    expect(formatEventLocationForChip({ location: { city: LISTED_ID } })).toBe(LISTED.title)
    expect(formatEventLocationForChip({ location: { locationName: 'האולם' } })).toBe('האולם')
    expect(formatEventLocationForChip({ location: {} })).toBe('לא ידוע')
    expect(formatEventLocationForChip({})).toBe('לא ידוע')
  })
})

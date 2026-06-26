import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS module, no types
import {
  eventMatchesRegions,
  eventMatchesCategories,
  flattenEventsByOccurrence,
  getEventDateString,
  getActiveEvents,
  getOccurrenceMinutesOfDay,
  occurrenceOverlapsTimeRange,
} from '~/utils/events.service'
// @ts-expect-error — plain JS consts, no types
import { CITIES } from '~/consts/regions.const.js'

// A real listed city + its region, derived from the registry (robust to list changes).
const [LISTED_ID, LISTED] = Object.entries(CITIES as Record<string, { title: string; region: string }>)[0]
const OTHER_REGION = ['center', 'golan', 'upper'].find((r) => r !== LISTED.region)!

describe('eventMatchesRegions', () => {
  it('resolves a listed city to its region via CITIES (the server-side region bug case)', () => {
    const ev = { location: { cityType: 'listed', city: LISTED_ID } }
    expect(eventMatchesRegions(ev, [LISTED.region])).toBe(true)
    expect(eventMatchesRegions(ev, [OTHER_REGION])).toBe(false)
  })

  it('uses the stored region for custom cities', () => {
    const ev = { location: { cityType: 'custom', city: 'עיר בדיונית', region: 'golan' } }
    expect(eventMatchesRegions(ev, ['golan'])).toBe(true)
    expect(eventMatchesRegions(ev, ['upper'])).toBe(false)
  })

  it('includes events with no resolvable region (show until data exists)', () => {
    const ev = { location: { cityType: 'custom', city: 'עיר בדיונית' } }
    expect(eventMatchesRegions(ev, ['golan'])).toBe(true)
  })

  it('no filter when regionKeys is empty/missing', () => {
    const ev = { location: { cityType: 'listed', city: LISTED_ID } }
    expect(eventMatchesRegions(ev, [])).toBe(true)
    expect(eventMatchesRegions(ev, undefined)).toBe(true)
  })
})

describe('eventMatchesCategories', () => {
  it('matches when any category id overlaps', () => {
    expect(eventMatchesCategories({ categories: ['music', 'food'] }, ['food'])).toBe(true)
    expect(eventMatchesCategories({ categories: ['music', 'food'] }, ['art'])).toBe(false)
  })

  it('returns false when the event has no categories array', () => {
    expect(eventMatchesCategories({}, ['music'])).toBe(false)
    expect(eventMatchesCategories({ categories: 'music' }, ['music'])).toBe(false)
  })
})

describe('flattenEventsByOccurrence', () => {
  const event = {
    id: 'evt1',
    title: 'Fair',
    multiDayEvent: true,
    occurrences: [
      { date: '2026-07-03', startTime: '2026-07-03T07:00:00Z', hasTime: true },
      { date: '2026-07-04', startTime: '2026-07-04T07:00:00Z', hasTime: true },
    ],
  }

  it('produces one flat item per occurrence with id/sourceEventId and occurrence fields hoisted', () => {
    const flat = flattenEventsByOccurrence([event])
    expect(flat).toHaveLength(2)
    expect(flat[0].id).toBe('evt1-0')
    expect(flat[1].id).toBe('evt1-1')
    expect(flat.every((f: { sourceEventId: string }) => f.sourceEventId === 'evt1')).toBe(true)
    expect(flat[0].date).toBe('2026-07-03')
    expect(flat[1].date).toBe('2026-07-04')
    expect(flat[0].title).toBe('Fair')
  })

  it('preserves the full occurrences array on each flat item (for multi-day range display)', () => {
    const flat = flattenEventsByOccurrence([event])
    expect(Array.isArray(flat[0].occurrences)).toBe(true)
    expect(flat[0].occurrences).toHaveLength(2)
    expect(flat[1].occurrences).toHaveLength(2)
  })

  it('skips events with no occurrences and tolerates bad input', () => {
    expect(flattenEventsByOccurrence([{ id: 'x', occurrences: [] }])).toEqual([])
    expect(flattenEventsByOccurrence([{ id: 'x' }])).toEqual([])
    expect(flattenEventsByOccurrence(null)).toEqual([])
    expect(flattenEventsByOccurrence('nope')).toEqual([])
  })
})

describe('getEventDateString', () => {
  it('uses the explicit date when present', () => {
    expect(getEventDateString({ date: '2026-07-03' })).toBe('2026-07-03')
  })

  it('derives the date from startTime (Israel time) when no date field', () => {
    expect(getEventDateString({ startTime: '2026-07-03T10:00:00Z' })).toBe('2026-07-03')
  })

  it('returns null when neither is usable', () => {
    expect(getEventDateString({})).toBeNull()
    expect(getEventDateString(null)).toBeNull()
  })
})

describe('getActiveEvents', () => {
  it('keeps only events with isActive === true', () => {
    const result = getActiveEvents([{ isActive: true, id: 'a' }, { isActive: false, id: 'b' }, { id: 'c' }])
    expect(result.map((e: { id: string }) => e.id)).toEqual(['a'])
  })
})

describe('getOccurrenceMinutesOfDay / occurrenceOverlapsTimeRange (all-day branch only)', () => {
  // NOTE: the *timed* branch reads local new Date(startTime).getHours(), which is the
  // browser's timezone — correct for Israel-based clients but not deterministic in a test
  // runner. We therefore only assert the all-day / no-time branches here (TZ-independent).
  it('all-day occurrence spans the whole day (0..1440)', () => {
    expect(getOccurrenceMinutesOfDay({ hasTime: false })).toEqual({ startMinutes: 0, endMinutes: 1440 })
    expect(getOccurrenceMinutesOfDay({ hasTime: true, startTime: undefined })).toEqual({ startMinutes: 0, endMinutes: 1440 })
  })

  it('all-day occurrence overlaps any sub-range within the day', () => {
    expect(occurrenceOverlapsTimeRange({ hasTime: false }, 600, 720)).toBe(true)
    expect(occurrenceOverlapsTimeRange({ hasTime: false }, 0, 1440)).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS module, no types
import { normalizeOccurrenceTime, normalizeFormattedEventOccurrences } from '~/packages/event-format/occurrenceUtils.js'

// The shared AI-output contract used by the crawler + wa-bot + web extractor. Deterministic
// (the package's own israelDate helpers compute the offset from the input date).

describe('normalizeOccurrenceTime', () => {
  it('passes through already-canonical ISO (Z or numeric offset)', () => {
    expect(normalizeOccurrenceTime('2026-07-03T10:00:00Z')).toBe('2026-07-03T10:00:00Z')
    expect(normalizeOccurrenceTime('2026-07-03T10:00:00+03:00')).toBe('2026-07-03T10:00:00+03:00')
  })

  it('converts Israel-local (no timezone) date-time to UTC', () => {
    expect(normalizeOccurrenceTime('2026-01-15T20:00')).toBe('2026-01-15T18:00:00.000Z')
  })

  it('converts a date-only string to Israel-midnight UTC', () => {
    expect(normalizeOccurrenceTime('2026-01-15')).toBe('2026-01-14T22:00:00.000Z')
  })

  it('returns non-strings and unparseable input unchanged', () => {
    expect(normalizeOccurrenceTime(null)).toBeNull()
    expect(normalizeOccurrenceTime(undefined)).toBeUndefined()
    expect(normalizeOccurrenceTime('not a date')).toBe('not a date')
  })
})

describe('normalizeFormattedEventOccurrences', () => {
  it('returns [] for empty/invalid input', () => {
    expect(normalizeFormattedEventOccurrences([])).toEqual([])
    expect(normalizeFormattedEventOccurrences(null)).toEqual([])
  })

  it('keeps a valid timed occurrence', () => {
    const out = normalizeFormattedEventOccurrences([
      { date: '2026-07-03', hasTime: true, startTime: '2026-07-03T07:00:00Z', endTime: '2026-07-03T09:00:00Z' },
    ])
    expect(out).toEqual([
      { date: '2026-07-03', hasTime: true, startTime: '2026-07-03T07:00:00Z', endTime: '2026-07-03T09:00:00Z' },
    ])
  })

  it('repairs a time-only startTime by combining it with the date (Israel→UTC)', () => {
    const [o] = normalizeFormattedEventOccurrences([{ date: '2026-01-15', hasTime: true, startTime: '18:00' }])
    expect(o).toEqual({ date: '2026-01-15', hasTime: true, startTime: '2026-01-15T16:00:00.000Z', endTime: null })
  })

  it('handles all-day (hasTime:false) as Israel-midnight UTC', () => {
    const [o] = normalizeFormattedEventOccurrences([{ date: '2026-01-15', hasTime: false }])
    expect(o).toEqual({ date: '2026-01-15', hasTime: false, startTime: '2026-01-14T22:00:00.000Z', endTime: null })
  })

  it('uses rawOccurrences as a single-occurrence time fallback', () => {
    const [o] = normalizeFormattedEventOccurrences(
      [{ date: '2026-02-28', hasTime: true, startTime: '' }],
      '28.2.26 18:00',
    )
    expect(o.startTime).toBe('2026-02-28T16:00:00.000Z')
    expect(o.hasTime).toBe(true)
  })

  it('nulls an endTime that is not after the start', () => {
    const [o] = normalizeFormattedEventOccurrences([
      { date: '2026-07-03', hasTime: true, startTime: '2026-07-03T10:00:00Z', endTime: '2026-07-03T09:00:00Z' },
    ])
    expect(o.endTime).toBeNull()
  })

  it('derives the date from startTime when no date field is present', () => {
    const [o] = normalizeFormattedEventOccurrences([{ hasTime: true, startTime: '2026-07-03T07:00:00Z' }])
    expect(o.date).toBe('2026-07-03')
  })

  it('drops null / non-object occurrences', () => {
    const out = normalizeFormattedEventOccurrences([
      null,
      { date: '2026-07-03', hasTime: true, startTime: '2026-07-03T07:00:00Z' },
    ])
    expect(out).toHaveLength(1)
  })
})

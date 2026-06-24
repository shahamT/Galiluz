import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS helper, no types
import { areDatesConsecutive, formatEventDateRange, formatEventDateAndDay } from '~/utils/date.helpers'

describe('areDatesConsecutive', () => {
  it('returns true for a gapless run of consecutive days', () => {
    expect(areDatesConsecutive(['2026-07-03', '2026-07-04', '2026-07-05'])).toBe(true)
    expect(areDatesConsecutive(['2026-07-03', '2026-07-04'])).toBe(true)
  })

  it('returns false when there is a gap', () => {
    expect(areDatesConsecutive(['2026-07-03', '2026-07-05'])).toBe(false)
    expect(areDatesConsecutive(['2026-07-03', '2026-07-04', '2026-07-06'])).toBe(false)
  })

  it('is order-independent (sorts first)', () => {
    expect(areDatesConsecutive(['2026-07-05', '2026-07-03', '2026-07-04'])).toBe(true)
  })

  it('ignores duplicates but still needs ≥2 distinct days', () => {
    expect(areDatesConsecutive(['2026-07-03', '2026-07-03'])).toBe(false)
    expect(areDatesConsecutive(['2026-07-03', '2026-07-03', '2026-07-04'])).toBe(true)
  })

  it('returns false for single / empty / nullish input', () => {
    expect(areDatesConsecutive(['2026-07-03'])).toBe(false)
    expect(areDatesConsecutive([])).toBe(false)
    expect(areDatesConsecutive(undefined)).toBe(false)
    expect(areDatesConsecutive(null)).toBe(false)
  })

  it('handles month and year boundaries', () => {
    expect(areDatesConsecutive(['2026-03-31', '2026-04-01'])).toBe(true)
    expect(areDatesConsecutive(['2026-12-31', '2027-01-01'])).toBe(true)
  })

  it('handles the Israel spring-forward DST boundary (calendar-field stepping)', () => {
    // DST starts ~27.3.2026 in Israel; calendar stepping must stay correct regardless of TZ.
    expect(areDatesConsecutive(['2026-03-27', '2026-03-28', '2026-03-29'])).toBe(true)
  })

  it('ignores invalid date strings', () => {
    expect(areDatesConsecutive(['2026-07-03', 'not-a-date', '2026-07-04'])).toBe(true)
    expect(areDatesConsecutive(['', '   '])).toBe(false)
  })
})

describe('formatEventDateRange', () => {
  it('joins two distinct day labels with " - "', () => {
    const start = '2026-07-03'
    const end = '2026-07-05'
    expect(formatEventDateRange(start, end)).toBe(
      `${formatEventDateAndDay(start)} - ${formatEventDateAndDay(end)}`,
    )
  })

  it('collapses to a single label when start === end', () => {
    expect(formatEventDateRange('2026-07-03', '2026-07-03')).toBe(formatEventDateAndDay('2026-07-03'))
  })

  it('falls back to the start label when end is missing or invalid', () => {
    expect(formatEventDateRange('2026-07-03', '')).toBe(formatEventDateAndDay('2026-07-03'))
    expect(formatEventDateRange('2026-07-03', 'garbage')).toBe(formatEventDateAndDay('2026-07-03'))
  })

  it('returns empty string when the start date is invalid', () => {
    expect(formatEventDateRange('', '2026-07-05')).toBe('')
    expect(formatEventDateRange('garbage', '2026-07-05')).toBe('')
  })
})

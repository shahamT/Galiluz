import { describe, it, expect } from 'vitest'
import { getIsraelDayUtcRange } from '~/server/utils/israelDateRange'
// @ts-expect-error — plain JS helper, no types
import { getDateInIsraelFromIso } from '~/utils/israelDate'

const DAY_MS = 24 * 60 * 60 * 1000

function assertCoversIsraelDay(dateStr: string) {
  const range = getIsraelDayUtcRange(dateStr)
  expect(range).not.toBeNull()
  const { startUTC, endUTC } = range!
  // The first and last covered instants both map to the requested Israel date…
  expect(getDateInIsraelFromIso(startUTC.toISOString())).toBe(dateStr)
  expect(getDateInIsraelFromIso(endUTC.toISOString())).toBe(dateStr)
  // …and the instants just outside the range fall on the neighbouring days.
  expect(getDateInIsraelFromIso(new Date(startUTC.getTime() - 1).toISOString()))
    .toBe(getDateInIsraelFromIso(new Date(startUTC.getTime() - DAY_MS / 2).toISOString()))
  expect(getDateInIsraelFromIso(new Date(startUTC.getTime() - 1).toISOString())).not.toBe(dateStr)
  expect(getDateInIsraelFromIso(new Date(endUTC.getTime() + 1).toISOString())).not.toBe(dateStr)
  // A normal (non-DST-transition) day spans ~24h.
  const span = endUTC.getTime() - startUTC.getTime()
  expect(span).toBeGreaterThan(23 * 60 * 60 * 1000)
  expect(span).toBeLessThan(25 * 60 * 60 * 1000)
}

describe('getIsraelDayUtcRange', () => {
  it('covers exactly the requested Israel day (winter)', () => {
    assertCoversIsraelDay('2026-01-15')
  })

  it('covers exactly the requested Israel day (summer DST)', () => {
    assertCoversIsraelDay('2026-07-15')
  })

  it('startUTC is the first instant and endUTC the last instant of the day', () => {
    const { startUTC, endUTC } = getIsraelDayUtcRange('2026-01-15')!
    expect(getDateInIsraelFromIso(new Date(startUTC.getTime() - 1).toISOString())).toBe('2026-01-14')
    expect(getDateInIsraelFromIso(new Date(endUTC.getTime() + 1).toISOString())).toBe('2026-01-16')
  })

  it('returns null for invalid input', () => {
    expect(getIsraelDayUtcRange('bad')).toBeNull()
    expect(getIsraelDayUtcRange('2026-13-01')).toBeNull()
    expect(getIsraelDayUtcRange('')).toBeNull()
    expect(getIsraelDayUtcRange(null as unknown as string)).toBeNull()
  })
})

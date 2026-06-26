import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS module, no types
import {
  formatDateToYYYYMMDD,
  parseDateString,
  getNextDay,
  getPrevDay,
  getNextMonth,
  getPrevMonth,
  isValidMonth,
  isValidYear,
  formatMinutesToTime,
  isMonthBefore,
  isSameMonth,
  formatMonthYear,
  formatKanbanDateHeader,
  formatEventDateAndDay,
} from '~/utils/date.helpers'
// @ts-expect-error — plain JS consts, no types
import { HEBREW_MONTHS, HEBREW_WEEKDAYS } from '~/consts/dates.const'

describe('formatDateToYYYYMMDD', () => {
  it('formats a Date to YYYY-MM-DD (zero-padded)', () => {
    expect(formatDateToYYYYMMDD(new Date(2026, 6, 3))).toBe('2026-07-03')
  })
  it('throws on an invalid Date', () => {
    expect(() => formatDateToYYYYMMDD(new Date('nonsense'))).toThrow()
  })
})

describe('parseDateString', () => {
  it('parses a valid YYYY-MM-DD', () => {
    const d = parseDateString('2026-07-03')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 6, 3])
  })
  it('throws on a bad format', () => {
    expect(() => parseDateString('07/03/2026')).toThrow()
    expect(() => parseDateString('bad')).toThrow()
  })
  it('throws on an impossible calendar date', () => {
    expect(() => parseDateString('2026-02-31')).toThrow()
    expect(() => parseDateString('2026-13-01')).toThrow()
  })
})

describe('day navigation', () => {
  it('advances across month and year boundaries', () => {
    expect(getNextDay('2026-07-31')).toBe('2026-08-01')
    expect(getNextDay('2026-12-31')).toBe('2027-01-01')
  })
  it('goes back across boundaries', () => {
    expect(getPrevDay('2026-01-01')).toBe('2025-12-31')
    expect(getPrevDay('2026-08-01')).toBe('2026-07-31')
  })
})

describe('month navigation', () => {
  it('wraps December → January and January → December', () => {
    expect(getNextMonth(2026, 12)).toEqual({ year: 2027, month: 1 })
    expect(getPrevMonth(2026, 1)).toEqual({ year: 2025, month: 12 })
    expect(getNextMonth(2026, 6)).toEqual({ year: 2026, month: 7 })
  })
})

describe('validators', () => {
  it('isValidMonth', () => {
    expect(isValidMonth(1)).toBe(true)
    expect(isValidMonth(12)).toBe(true)
    expect(isValidMonth(0)).toBe(false)
    expect(isValidMonth(13)).toBe(false)
    expect(isValidMonth(1.5)).toBe(false)
  })
  it('isValidYear', () => {
    expect(isValidYear(2026)).toBe(true)
    expect(isValidYear(1899)).toBe(false)
    expect(isValidYear(2101)).toBe(false)
  })
})

describe('formatMinutesToTime', () => {
  it('formats minutes-from-midnight as HH:MM', () => {
    expect(formatMinutesToTime(0)).toBe('00:00')
    expect(formatMinutesToTime(90)).toBe('01:30')
    expect(formatMinutesToTime(1439)).toBe('23:59')
  })
})

describe('month comparison', () => {
  it('isMonthBefore', () => {
    expect(isMonthBefore({ year: 2025, month: 12 }, { year: 2026, month: 1 })).toBe(true)
    expect(isMonthBefore({ year: 2026, month: 3 }, { year: 2026, month: 2 })).toBe(false)
    expect(isMonthBefore({ year: 2026, month: 5 }, { year: 2026, month: 5 })).toBe(false)
    expect(isMonthBefore(null, { year: 2026, month: 1 })).toBe(false)
  })
  it('isSameMonth', () => {
    expect(isSameMonth({ year: 2026, month: 7 }, { year: 2026, month: 7 })).toBe(true)
    expect(isSameMonth({ year: 2026, month: 7 }, { year: 2026, month: 8 })).toBe(false)
    expect(isSameMonth(null, { year: 2026, month: 7 })).toBe(false)
  })
})

describe('Hebrew formatting', () => {
  it('formatMonthYear uses the Hebrew month name', () => {
    expect(formatMonthYear(2026, 2)).toBe(`${HEBREW_MONTHS[1]} 2026`)
  })
  it('formatKanbanDateHeader is "<weekday>, D.M"', () => {
    const d = new Date(2026, 6, 3)
    expect(formatKanbanDateHeader('2026-07-03')).toBe(`${HEBREW_WEEKDAYS[d.getDay()]}, 3.7`)
  })
  it('formatEventDateAndDay is "יום <weekday>, D.M" and empty on invalid', () => {
    const d = new Date(2026, 6, 3)
    expect(formatEventDateAndDay('2026-07-03')).toBe(`יום ${HEBREW_WEEKDAYS[d.getDay()]}, 3.7`)
    expect(formatEventDateAndDay('bad')).toBe('')
  })
})

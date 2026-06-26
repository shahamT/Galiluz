import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS module, no types
import { generateCalendarDays } from '~/utils/calendar.helpers'

interface Day { dayNumber: number; isOutsideMonth: boolean; eventsCount: number; dateString: string; events: unknown[] }

function check(year: number, month: number) {
  const days: Day[] = generateCalendarDays(year, month)
  // Complete weeks.
  expect(days.length % 7).toBe(0)
  // Leading outside-month days === weekday index of the 1st.
  const startDow = new Date(year, month - 1, 1).getDay()
  const leading = days.findIndex((d) => !d.isOutsideMonth)
  expect(leading).toBe(startDow)
  // Exactly daysInMonth in-month entries, dated 01..end in order.
  const inMonth = days.filter((d) => !d.isOutsideMonth)
  const daysInMonth = new Date(year, month, 0).getDate()
  expect(inMonth).toHaveLength(daysInMonth)
  expect(inMonth[0].dayNumber).toBe(1)
  const mm = String(month).padStart(2, '0')
  expect(inMonth[0].dateString).toBe(`${year}-${mm}-01`)
  expect(inMonth[daysInMonth - 1].dateString).toBe(`${year}-${mm}-${String(daysInMonth).padStart(2, '0')}`)
}

describe('generateCalendarDays', () => {
  it('builds a valid grid for a month with leading days (2026-07)', () => {
    check(2026, 7)
  })

  it('builds a valid grid for February (2026-02)', () => {
    check(2026, 2)
  })

  it('applies event counts and events to the matching date only', () => {
    const days: Day[] = generateCalendarDays(2026, 7, { '2026-07-15': 3 }, { '2026-07-15': [{ id: 'e1' }] })
    const target = days.find((d) => d.dateString === '2026-07-15')!
    expect(target.eventsCount).toBe(3)
    expect(target.events).toHaveLength(1)
    const other = days.find((d) => d.dateString === '2026-07-16')!
    expect(other.eventsCount).toBe(0)
    expect(other.events).toEqual([])
  })
})

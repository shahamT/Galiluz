import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS helper, no types
import {
  getDateInIsraelFromIso,
  getTimeInIsraelFromIso,
  israelMidnightToUtcIso,
  localTimeIsraelToUtcIso,
} from '~/utils/israelDate'

// Israel is UTC+2 in winter and UTC+3 in summer (DST). These tests use an explicit
// Asia/Jerusalem zone (or the date's own offset), so they are deterministic regardless
// of the machine timezone running them.

describe('getDateInIsraelFromIso', () => {
  it('returns the Israel calendar date for a UTC instant (winter +2)', () => {
    expect(getDateInIsraelFromIso('2026-01-15T10:00:00Z')).toBe('2026-01-15')
  })

  it('rolls over to the next Israel day when UTC late evening crosses midnight (winter)', () => {
    // 22:30Z + 2h = 00:30 next day in Israel
    expect(getDateInIsraelFromIso('2026-01-15T22:30:00Z')).toBe('2026-01-16')
  })

  it('handles summer DST (+3)', () => {
    expect(getDateInIsraelFromIso('2026-07-15T20:00:00Z')).toBe('2026-07-15')
    // 21:30Z + 3h = 00:30 next day
    expect(getDateInIsraelFromIso('2026-07-15T21:30:00Z')).toBe('2026-07-16')
  })

  it('returns null for invalid input', () => {
    expect(getDateInIsraelFromIso('')).toBeNull()
    expect(getDateInIsraelFromIso(null as unknown as string)).toBeNull()
    expect(getDateInIsraelFromIso('not-a-date')).toBeNull()
  })
})

describe('getTimeInIsraelFromIso', () => {
  it('converts to Israel HH:MM (winter +2 / summer +3)', () => {
    expect(getTimeInIsraelFromIso('2026-01-15T10:00:00Z')).toBe('12:00')
    expect(getTimeInIsraelFromIso('2026-07-15T10:00:00Z')).toBe('13:00')
  })

  it('handles past-midnight rollover time', () => {
    expect(getTimeInIsraelFromIso('2026-01-15T22:30:00Z')).toBe('00:30')
  })

  it('returns empty string for invalid input', () => {
    expect(getTimeInIsraelFromIso('')).toBe('')
    expect(getTimeInIsraelFromIso('garbage')).toBe('')
  })
})

describe('israelMidnightToUtcIso', () => {
  it('returns the UTC instant of Israel midnight (winter +2)', () => {
    expect(israelMidnightToUtcIso('2026-01-15')).toBe('2026-01-14T22:00:00.000Z')
  })

  it('returns the UTC instant of Israel midnight (summer +3)', () => {
    expect(israelMidnightToUtcIso('2026-07-15')).toBe('2026-07-14T21:00:00.000Z')
  })

  it('round-trips: that instant is the start of the given Israel day', () => {
    expect(getDateInIsraelFromIso(israelMidnightToUtcIso('2026-01-15'))).toBe('2026-01-15')
    expect(getDateInIsraelFromIso(israelMidnightToUtcIso('2026-07-15'))).toBe('2026-07-15')
  })

  it('returns the input unchanged when not a YYYY-MM-DD date', () => {
    expect(israelMidnightToUtcIso('bad')).toBe('bad')
  })
})

describe('localTimeIsraelToUtcIso', () => {
  it('converts Israel local date+time to UTC (winter +2)', () => {
    expect(localTimeIsraelToUtcIso('2026-01-15', '08:00')).toBe('2026-01-15T06:00:00.000Z')
  })

  it('converts Israel local date+time to UTC (summer +3)', () => {
    expect(localTimeIsraelToUtcIso('2026-07-15', '08:00')).toBe('2026-07-15T05:00:00.000Z')
  })

  it('round-trips back to the same Israel wall-clock time', () => {
    expect(getTimeInIsraelFromIso(localTimeIsraelToUtcIso('2026-01-15', '08:30'))).toBe('08:30')
    expect(getTimeInIsraelFromIso(localTimeIsraelToUtcIso('2026-07-15', '23:45'))).toBe('23:45')
  })

  it('returns empty string for invalid date or time', () => {
    expect(localTimeIsraelToUtcIso('bad', '08:00')).toBe('')
    expect(localTimeIsraelToUtcIso('2026-01-15', '25:00')).toBe('')
    expect(localTimeIsraelToUtcIso('2026-01-15', '12:99')).toBe('')
  })
})

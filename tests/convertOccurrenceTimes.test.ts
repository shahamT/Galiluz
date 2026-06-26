import { describe, it, expect } from 'vitest'
import { convertOccurrenceTimes } from '~/server/utils/convertOccurrenceTimes'

// Write path: the form sends date (YYYY-MM-DD) + HH:MM (Israel local); this converts to
// canonical ISO UTC for storage. Deterministic (the Israel helpers use the date's own offset).

describe('convertOccurrenceTimes', () => {
  it('all-day occurrence → Israel-midnight UTC start, null end (winter +2)', () => {
    const [o] = convertOccurrenceTimes([{ date: '2026-01-15', hasTime: false, startTime: 'ignored' }])
    expect(o).toMatchObject({ date: '2026-01-15', hasTime: false, startTime: '2026-01-14T22:00:00.000Z', endTime: null })
  })

  it('all-day occurrence in summer uses the +3 offset', () => {
    const [o] = convertOccurrenceTimes([{ date: '2026-07-15', hasTime: false }])
    expect((o as { startTime: string }).startTime).toBe('2026-07-14T21:00:00.000Z')
  })

  it('timed occurrence converts start and end (winter +2)', () => {
    const [o] = convertOccurrenceTimes([{ date: '2026-01-15', hasTime: true, startTime: '20:00', endTime: '22:00' }])
    expect(o).toMatchObject({
      date: '2026-01-15',
      startTime: '2026-01-15T18:00:00.000Z',
      endTime: '2026-01-15T20:00:00.000Z',
    })
  })

  it('timed occurrence with no end → endTime null', () => {
    const [o] = convertOccurrenceTimes([{ date: '2026-07-15', hasTime: true, startTime: '08:00' }])
    expect((o as { startTime: string }).startTime).toBe('2026-07-15T05:00:00.000Z')
    expect((o as { endTime: unknown }).endTime).toBeNull()
  })

  it('missing startTime → passthrough with normalized date only (no conversion)', () => {
    const [o] = convertOccurrenceTimes([{ date: '2026-01-15', hasTime: true }])
    expect(o).toEqual({ date: '2026-01-15', hasTime: true })
  })

  it('slices the date to 10 chars', () => {
    const [o] = convertOccurrenceTimes([{ date: '2026-01-15T00:00:00Z', hasTime: false }])
    expect((o as { date: string }).date).toBe('2026-01-15')
  })

  it('tolerates non-array and non-object members', () => {
    expect(convertOccurrenceTimes(null as unknown as unknown[])).toEqual([])
    expect(convertOccurrenceTimes(['not-an-object'])).toEqual(['not-an-object'])
  })
})

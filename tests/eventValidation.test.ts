import { describe, it, expect } from 'vitest'
import { validatePublisherFormattedEvent } from '~/server/utils/eventValidation'

function validEvent(): Record<string, unknown> {
  return {
    Title: 'ערב מוזיקה',
    shortDescription: 'תיאור קצר',
    mainCategory: 'music',
    categories: ['music'],
    multiDayEvent: false,
    location: { city: 'קצרין', locationName: 'המרכז' },
    occurrences: [
      { date: '2026-07-01', hasTime: true, startTime: '2026-07-01T17:00:00.000Z', endTime: null },
    ],
    price: null,
    urls: [],
    media: [],
    publisherId: 'abc123',
  }
}

describe('validatePublisherFormattedEvent — occurrence invariants', () => {
  it('accepts a valid event', () => {
    const result = validatePublisherFormattedEvent(validEvent())
    expect(result.valid).toBe(true)
  })

  it('rejects empty occurrences', () => {
    const ev = validEvent()
    ev.occurrences = []
    expect(validatePublisherFormattedEvent(ev).valid).toBe(false)
  })

  it('rejects occurrences with non-ISO startTime (enforces the canonical string format)', () => {
    const ev = validEvent()
    ev.occurrences = [{ date: '2026-07-01', hasTime: true, startTime: 'tomorrow evening', endTime: null }]
    expect(validatePublisherFormattedEvent(ev).valid).toBe(false)
  })

  it('rejects occurrences missing date or hasTime', () => {
    const ev = validEvent()
    ev.occurrences = [{ startTime: '2026-07-01T17:00:00.000Z' }]
    expect(validatePublisherFormattedEvent(ev).valid).toBe(false)
  })

  it('rejects endTime before startTime', () => {
    const ev = validEvent()
    ev.occurrences = [
      { date: '2026-07-01', hasTime: true, startTime: '2026-07-01T17:00:00.000Z', endTime: '2026-07-01T16:00:00.000Z' },
    ]
    expect(validatePublisherFormattedEvent(ev).valid).toBe(false)
  })
})

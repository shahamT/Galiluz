import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS helper, no types
import { resolveCityName } from '~/utils/events.helpers'
// @ts-expect-error — plain JS consts, no types
import { CITIES } from '~/consts/regions.const.js'

const [firstId, firstEntry] = Object.entries(CITIES)[0] as [string, { title: string }]

describe('resolveCityName', () => {
  it('resolves a listed city ID to its Hebrew title (the reported bug: "Gadot" → "גדות")', () => {
    expect(resolveCityName(firstId)).toBe(firstEntry.title)
  })

  it('is idempotent for an already-resolved Hebrew title', () => {
    expect(resolveCityName(firstEntry.title)).toBe(firstEntry.title)
  })

  it('returns a custom (non-listed) city name unchanged', () => {
    expect(resolveCityName('כפר בדיוני שלא קיים ברשימה')).toBe('כפר בדיוני שלא קיים ברשימה')
  })

  it('returns empty string for falsy input', () => {
    expect(resolveCityName('')).toBe('')
    expect(resolveCityName(undefined)).toBe('')
    expect(resolveCityName(null)).toBe('')
  })
})

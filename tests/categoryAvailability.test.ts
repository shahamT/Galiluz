import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS consts, no types
import {
  EVENT_CATEGORIES,
  isCategoryAvailable,
  getAvailableCategoryGroups,
  getCategoriesList,
} from '~/consts/events.const.js'

describe('isCategoryAvailable', () => {
  it('returns false for a missing category', () => {
    expect(isCategoryAvailable(undefined, '2026-07-01')).toBe(false)
  })

  it('is always available when there is no window', () => {
    expect(isCategoryAvailable({ label: 'x' }, '2020-01-01')).toBe(true)
  })

  it('gates the mundial window (2026-06-11 … 2026-07-20, inclusive)', () => {
    const mundial = EVENT_CATEGORIES.mundial
    expect(isCategoryAvailable(mundial, '2026-06-10')).toBe(false)
    expect(isCategoryAvailable(mundial, '2026-06-11')).toBe(true)
    expect(isCategoryAvailable(mundial, '2026-07-20')).toBe(true)
    expect(isCategoryAvailable(mundial, '2026-07-21')).toBe(false)
  })
})

describe('getAvailableCategoryGroups', () => {
  it('drops mundial from its group when out of window, keeps it when in window', () => {
    const groupOf = (groups: Array<{ id: string; categoryIds: string[] }>) =>
      groups.find((g) => g.id === 'music_nature_movement')!

    const out = getAvailableCategoryGroups('2026-01-01')
    expect(groupOf(out).categoryIds).not.toContain('mundial')

    const inWindow = getAvailableCategoryGroups('2026-07-01')
    expect(groupOf(inWindow).categoryIds).toContain('mundial')
  })

  it('retains all four groups (none becomes empty)', () => {
    expect(getAvailableCategoryGroups('2026-01-01')).toHaveLength(4)
  })
})

describe('getCategoriesList', () => {
  it('lists every category as {id, label}', () => {
    const list = getCategoriesList()
    expect(list).toHaveLength(Object.keys(EVENT_CATEGORIES).length)
    expect(list[0]).toHaveProperty('id')
    expect(list[0]).toHaveProperty('label')
    expect(list.find((c: { id: string }) => c.id === 'mundial')?.label).toBe(EVENT_CATEGORIES.mundial.label)
  })
})

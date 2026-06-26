import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS module, no types
import {
  isValidDateString,
  parseCategories,
  serializeCategories,
  parseRegions,
  serializeRegions,
  parseTimeFilter,
} from '~/utils/validation.helpers'

describe('isValidDateString', () => {
  it('accepts a real YYYY-MM-DD', () => {
    expect(isValidDateString('2026-07-03')).toBe(true)
  })
  it('rejects impossible dates and bad formats', () => {
    expect(isValidDateString('2026-02-31')).toBe(false)
    expect(isValidDateString('2026-13-01')).toBe(false)
    expect(isValidDateString('07/03/2026')).toBe(false)
    expect(isValidDateString('')).toBe(false)
    expect(isValidDateString(null as unknown as string)).toBe(false)
  })
})

describe('categories (parse/serialize)', () => {
  it('parses a comma list and drops empties', () => {
    expect(parseCategories('music,food')).toEqual(['music', 'food'])
    expect(parseCategories('music,,food')).toEqual(['music', 'food'])
    expect(parseCategories('')).toEqual([])
    expect(parseCategories(undefined)).toEqual([])
  })
  it('serializes back, undefined when empty', () => {
    expect(serializeCategories(['music', 'food'])).toBe('music,food')
    expect(serializeCategories([])).toBeUndefined()
  })
})

describe('regions (parse/serialize)', () => {
  it('keeps only valid region keys', () => {
    expect(parseRegions('center,golan')).toEqual(['center', 'golan'])
    expect(parseRegions('center,mars')).toEqual(['center'])
    expect(parseRegions('')).toEqual([])
  })
  it('serializes back, undefined when empty', () => {
    expect(serializeRegions(['center'])).toBe('center')
    expect(serializeRegions([])).toBeUndefined()
    expect(serializeRegions(undefined)).toBeUndefined()
  })
})

describe('parseTimeFilter', () => {
  it('returns the numeric range for valid in-bounds values', () => {
    expect(parseTimeFilter(600, 720)).toEqual({ start: 600, end: 720 })
    expect(parseTimeFilter('600', '720')).toEqual({ start: 600, end: 720 })
  })
  it('falls back to the full day for invalid / out-of-bounds values', () => {
    expect(parseTimeFilter('abc', 'xyz')).toEqual({ start: 0, end: 1440 })
    expect(parseTimeFilter(-5, 2000)).toEqual({ start: 0, end: 1440 })
  })
})

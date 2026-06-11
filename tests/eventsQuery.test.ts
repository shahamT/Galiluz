import { describe, it, expect } from 'vitest'
import { buildEventsQuery, NOT_DELETED, parseDatesParam, parseCategoriesParam } from '~/server/utils/eventsQuery'

const CUTOFF = new Date('2026-06-01T00:00:00.000Z')

function andConditions(query: Record<string, unknown>) {
  return query.$and as Record<string, unknown>[]
}

describe('buildEventsQuery', () => {
  it('always excludes soft-deleted events', () => {
    const conditions = andConditions(buildEventsQuery(CUTOFF, [], []))
    expect(conditions).toContainEqual(NOT_DELETED)
  })

  it('only matches active events with a processed event object', () => {
    const conditions = andConditions(buildEventsQuery(CUTOFF, [], []))
    expect(conditions).toContainEqual({ isActive: true })
    expect(conditions).toContainEqual({ event: { $ne: null } })
  })

  it('bounds the feed when until is provided (both storage formats)', () => {
    const until = new Date('2026-08-31T23:59:59.999Z')
    const conditions = andConditions(buildEventsQuery(CUTOFF, [], [], undefined, until))
    expect(conditions).toContainEqual({
      $or: [
        { 'event.occurrences.startTime': { $lte: until } },
        { 'event.occurrences.startTime': { $lte: until.toISOString() } },
      ],
    })
  })

  it('omits the upper bound when until is absent', () => {
    const conditions = andConditions(buildEventsQuery(CUTOFF, [], []))
    const hasLte = JSON.stringify(conditions).includes('$lte')
    expect(hasLte).toBe(false)
  })

  it('adds region filter only for known regions', () => {
    const withRegion = andConditions(buildEventsQuery(CUTOFF, [], [], 'golan'))
    expect(withRegion).toContainEqual({ 'event.location.region': 'golan' })
    const withBadRegion = andConditions(buildEventsQuery(CUTOFF, [], [], 'mars'))
    expect(JSON.stringify(withBadRegion)).not.toContain('mars')
  })
})

describe('param parsing', () => {
  it('parses and dedupes valid dates, drops junk', () => {
    expect(parseDatesParam('2026-06-12,2026-06-12,not-a-date')).toEqual(['2026-06-12'])
    expect(parseDatesParam(undefined)).toEqual([])
  })

  it('parses categories with dedupe', () => {
    expect(parseCategoriesParam('music,music,sport')).toEqual(['music', 'sport'])
  })
})

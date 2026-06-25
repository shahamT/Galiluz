import { describe, it, expect } from 'vitest'
import { buildEventsQuery, NOT_DELETED, parseDatesParam, parseCategoriesParam } from '~/server/utils/eventsQuery'
// @ts-expect-error — plain JS consts, no types
import { CITIES } from '~/consts/regions.const.js'

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

  it('bounds the feed when until is provided', () => {
    const until = new Date('2026-08-31T23:59:59.999Z')
    const conditions = andConditions(buildEventsQuery(CUTOFF, [], [], undefined, until))
    expect(conditions).toContainEqual({
      'event.occurrences.startTime': { $lte: until.toISOString() },
    })
  })

  it('omits the upper bound when until is absent', () => {
    const conditions = andConditions(buildEventsQuery(CUTOFF, [], []))
    const hasLte = JSON.stringify(conditions).includes('$lte')
    expect(hasLte).toBe(false)
  })

  it('region filter matches the stored region OR a listed-city id in that region', () => {
    const conditions = andConditions(buildEventsQuery(CUTOFF, [], [], 'golan'))
    const regionClause = conditions.find(
      (c) => Array.isArray((c as { $or?: unknown[] }).$or)
        && (c as { $or: Record<string, unknown>[] }).$or.some((o) => o['event.location.region'] === 'golan'),
    ) as { $or: Record<string, unknown>[] } | undefined
    expect(regionClause).toBeTruthy()
    expect(regionClause!.$or).toContainEqual({ 'event.location.region': 'golan' })

    const cityClause = regionClause!.$or.find((o) => o['event.location.city']) as
      | { 'event.location.city': { $in: string[] } }
      | undefined
    expect(cityClause).toBeTruthy()
    const ids = cityClause!['event.location.city'].$in
    expect(ids.length).toBeGreaterThan(0)
    // Every id resolves to the requested region, and a known golan city is present.
    for (const id of ids) expect((CITIES as Record<string, { region: string }>)[id].region).toBe('golan')
    const aGolanCity = Object.keys(CITIES).find((id) => (CITIES as Record<string, { region: string }>)[id].region === 'golan')
    expect(ids).toContain(aGolanCity)
  })

  it('omits the region filter for unknown regions', () => {
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

import { getIsraelDayUtcRange } from '~/server/utils/israelDateRange'

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/

/** Filter fragment excluding soft-deleted documents (events and stats alike). */
export const NOT_DELETED = { deletedAt: { $exists: false } }

export function parseDatesParam(value: string | undefined): string[] {
  if (!value || typeof value !== 'string') return []
  const list = value
    .split(',')
    .map((s) => s.trim().slice(0, 10))
    .filter((s) => YYYY_MM_DD.test(s))
  return [...new Set(list)]
}

export function parseCategoriesParam(value: string | undefined): string[] {
  if (!value || typeof value !== 'string') return []
  const list = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return [...new Set(list)]
}

/**
 * Builds MongoDB query for events: active, with occurrences after cutoff, optional date and category filters.
 * `until` (exclusive upper bound) limits the feed to a rolling window — events whose
 * occurrences all start after it are excluded.
 */
export function buildEventsQuery(
  cutoff: Date,
  dateStrings: string[],
  categoriesArray: string[],
  region?: string,
  until?: Date,
): Record<string, unknown> {
  // startTime is canonically an ISO 8601 string — enforced by
  // validatePublisherFormattedEvent on writes and verified migrated on both
  // dev and production DBs (one-time startup migration, 2026-06-12).
  const cutoffISO = cutoff.toISOString()
  const baseConditions: Record<string, unknown>[] = [
    { 'event.occurrences.startTime': { $gt: cutoffISO } },
  ]

  const andConditions: Record<string, unknown>[] = [
    { isActive: true },
    { ...NOT_DELETED },
    { event: { $ne: null } },
    { $or: baseConditions },
  ]

  if (until) {
    andConditions.push({ 'event.occurrences.startTime': { $lte: until.toISOString() } })
  }

  if (dateStrings.length > 0) {
    const dateRanges = dateStrings
      .map((ds) => getIsraelDayUtcRange(ds))
      .filter((r): r is { startUTC: Date; endUTC: Date } => r !== null)
    if (dateRanges.length > 0) {
      const dateClauses = dateRanges.map(({ startUTC, endUTC }) => ({
        'event.occurrences': {
          $elemMatch: {
            startTime: { $gte: startUTC.toISOString(), $lte: endUTC.toISOString() },
          },
        },
      }))
      andConditions.push({ $or: dateClauses })
    }
  }

  if (categoriesArray.length > 0) {
    andConditions.push({
      $or: [
        { 'event.categories': { $in: categoriesArray } },
        { 'event.mainCategory': { $in: categoriesArray } },
      ],
    })
  }

  if (region && (region === 'center' || region === 'golan' || region === 'upper')) {
    andConditions.push({ 'event.location.region': region })
  }

  return { $and: andConditions }
}

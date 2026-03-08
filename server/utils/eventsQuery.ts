import { getIsraelDayUtcRange } from '~/server/utils/israelDateRange'
import { getCategoriesList } from '~/server/consts/events.const'

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/

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
  const validIds = new Set(getCategoriesList().map((c) => c.id))
  const list = value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && validIds.has(s))
  return [...new Set(list)]
}

/**
 * Builds MongoDB query for events: active, with occurrences after cutoff, optional date and category filters.
 */
export function buildEventsQuery(
  cutoff: Date,
  dateStrings: string[],
  categoriesArray: string[],
): Record<string, unknown> {
  const cutoffISO = cutoff.toISOString()
  const baseConditions: Record<string, unknown>[] = [
    { 'event.occurrences.startTime': { $gt: cutoff } },
    { 'event.occurrences.startTime': { $gt: cutoffISO } },
  ]

  const andConditions: Record<string, unknown>[] = [
    { isActive: true },
    { event: { $ne: null } },
    { $or: baseConditions },
  ]

  if (dateStrings.length > 0) {
    const dateRanges = dateStrings
      .map((ds) => getIsraelDayUtcRange(ds))
      .filter((r): r is { startUTC: Date; endUTC: Date } => r !== null)
    if (dateRanges.length > 0) {
      const dateClauses = dateRanges.flatMap(({ startUTC, endUTC }) => [
        { 'event.occurrences': { $elemMatch: { startTime: { $gte: startUTC, $lte: endUTC } } } },
        {
          'event.occurrences': {
            $elemMatch: {
              startTime: { $gte: startUTC.toISOString(), $lte: endUTC.toISOString() },
            },
          },
        },
      ])
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

  return { $and: andConditions }
}

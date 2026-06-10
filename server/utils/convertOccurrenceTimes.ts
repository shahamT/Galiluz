import { localTimeIsraelToUtcIso, israelMidnightToUtcIso } from '~/utils/israelDate.js'

/**
 * Converts occurrence time values from HH:MM (form input) to ISO 8601 UTC strings
 * suitable for storage and the validatePublisherFormattedEvent check.
 */
export function convertOccurrenceTimes(occs: unknown[]): unknown[] {
  if (!Array.isArray(occs)) return []
  return occs.map(occ => {
    if (!occ || typeof occ !== 'object') return occ
    const o = occ as Record<string, unknown>
    const date = String(o.date || '').slice(0, 10)
    if (o.hasTime === false) {
      return { ...o, date, startTime: israelMidnightToUtcIso(date) || o.startTime, endTime: null }
    }
    if (!o.startTime) return { ...o, date }
    const startIso = localTimeIsraelToUtcIso(date, String(o.startTime))
    const endIso = o.endTime ? localTimeIsraelToUtcIso(date, String(o.endTime)) : null
    return { ...o, date, startTime: startIso || o.startTime, endTime: endIso }
  })
}

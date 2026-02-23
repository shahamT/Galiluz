import { getDateInIsraelFromIso } from '~/utils/israelDate'

/**
 * Returns the UTC time range for a single calendar day in Israel (Asia/Jerusalem).
 * startUTC = first moment of that day in Israel; endUTC = last moment (23:59:59.999).
 *
 * @param dateString - YYYY-MM-DD (Israel calendar date)
 * @returns { startUTC, endUTC } or null if dateString is invalid
 */
export function getIsraelDayUtcRange(dateString: string): { startUTC: Date; endUTC: Date } | null {
  if (!dateString || typeof dateString !== 'string') return null
  const trimmed = dateString.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const [y, m, d] = trimmed.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null

  // Search window: from 24h before to 24h after UTC midnight of that calendar day
  const utcMidnight = Date.UTC(y, m - 1, d, 0, 0, 0, 0)
  const low = utcMidnight - 24 * 60 * 60 * 1000
  const high = utcMidnight + 48 * 60 * 60 * 1000

  // Binary search: smallest T such that getDateInIsraelFromIso(T) === trimmed
  let startMs = high
  let lo = low
  let hi = high
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const candidate = new Date(mid).toISOString()
    const inIsrael = getDateInIsraelFromIso(candidate)
    if (inIsrael === trimmed) {
      startMs = mid
      hi = mid - 1
    } else if (inIsrael && inIsrael < trimmed) {
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  // Binary search: largest T such that getDateInIsraelFromIso(T) === trimmed
  let endMs = low
  lo = low
  hi = high
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const candidate = new Date(mid).toISOString()
    const inIsrael = getDateInIsraelFromIso(candidate)
    if (inIsrael === trimmed) {
      endMs = mid
      lo = mid + 1
    } else if (inIsrael && inIsrael > trimmed) {
      hi = mid - 1
    } else {
      lo = mid + 1
    }
  }

  if (startMs > endMs) return null
  return {
    startUTC: new Date(startMs),
    endUTC: new Date(endMs),
  }
}

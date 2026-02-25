import {
  getDateInIsraelFromIso,
  israelMidnightToUtcIso,
  localTimeIsraelToUtcIso,
} from '~/utils/israelDate'
import { FALLBACK_CATEGORY_ID } from '~/server/consts/publisherEventConsts'

/** Publisher-formatted event validation and normalization (wa-bot flow). */
const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/
/** ISO 8601 date-time (UTC or with offset). Seconds required; optional fractional seconds and Z or ±HH:MM. */
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/

type OccurrenceLike = Record<string, unknown> & {
  date?: string
  hasTime?: boolean
  startTime?: string
  endTime?: string | null
}

/**
 * Normalize and correct a publisher-formatted event in place (categories fallback, occurrence date/time alignment, endTime validity).
 * Call before validatePublisherFormattedEvent so structure is solid.
 */
export function normalizePublisherFormattedEvent(
  event: Record<string, unknown>,
  validCategoryIds: string[],
): void {
  const categories = Array.isArray(event.categories) ? (event.categories as string[]) : []
  const validCats = categories.filter((c) => typeof c === 'string' && validCategoryIds.includes(c))
  if (validCats.length === 0) {
    event.categories = [FALLBACK_CATEGORY_ID]
    event.mainCategory = FALLBACK_CATEGORY_ID
  } else {
    event.categories = validCats
    const main = typeof event.mainCategory === 'string' ? event.mainCategory : ''
    if (!validCats.includes(main)) {
      event.mainCategory = validCats[0]
    }
  }

  const occurrences = Array.isArray(event.occurrences) ? (event.occurrences as OccurrenceLike[]) : []
  for (const occ of occurrences) {
    if (!occ || typeof occ !== 'object') continue
    const dateStr = typeof occ.date === 'string' ? occ.date.trim().slice(0, 10) : ''
    if (!YYYY_MM_DD.test(dateStr)) continue

    if (occ.hasTime === false) {
      const midnight = israelMidnightToUtcIso(dateStr)
      if (midnight) {
        occ.startTime = midnight
        occ.endTime = null
      }
      continue
    }

    const startTime = typeof occ.startTime === 'string' ? occ.startTime.trim() : ''
    if (!startTime || !ISO_DATETIME.test(startTime)) continue

    const startDateIsrael = getDateInIsraelFromIso(startTime)
    if (startDateIsrael && startDateIsrael !== dateStr) {
      const d = new Date(startTime)
      if (!Number.isNaN(d.getTime())) {
        const h = parseInt(
          d.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hour12: false }),
          10
        )
        const m = parseInt(
          d.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem', minute: '2-digit' }),
          10
        )
        const timeStr = `${h}:${String(m).padStart(2, '0')}`
        const rebuilt = localTimeIsraelToUtcIso(dateStr, timeStr)
        if (rebuilt) occ.startTime = rebuilt
      }
    }

    let endTime = occ.endTime
    if (endTime != null && typeof endTime === 'string' && endTime.trim()) {
      const endTrimmed = endTime.trim()
      if (!ISO_DATETIME.test(endTrimmed)) {
        occ.endTime = null
      } else {
        const startMs = new Date(startTime).getTime()
        const endMs = new Date(endTrimmed).getTime()
        if (Number.isNaN(endMs) || endMs <= startMs) {
          occ.endTime = null
        }
      }
    } else {
      occ.endTime = null
    }
  }
}

/**
 * Light structure validation for publisher-formatted events (wa-bot flow).
 * No justifications or evidence checks — we only validate shape and required fields.
 * endTime, when present, must be valid ISO and after startTime (normalizePublisherFormattedEvent clears invalid ones).
 */
export function validatePublisherFormattedEvent(event: unknown): { valid: true } | { valid: false; reason: string } {
  if (!event || typeof event !== 'object') {
    return { valid: false, reason: 'Event is not an object' }
  }
  const e = event as Record<string, unknown>
  if (typeof e.Title !== 'string' || !e.Title.trim()) {
    return { valid: false, reason: 'Missing or empty Title' }
  }
  if (!Array.isArray(e.categories) || e.categories.length === 0) {
    return { valid: false, reason: 'Missing or empty categories' }
  }
  if (typeof e.mainCategory !== 'string' || !e.mainCategory.trim()) {
    return { valid: false, reason: 'Missing mainCategory' }
  }
  if (!e.categories.includes(e.mainCategory)) {
    return { valid: false, reason: 'mainCategory not in categories' }
  }
  if (!e.location || typeof e.location !== 'object') {
    return { valid: false, reason: 'Missing location' }
  }
  const loc = e.location as Record<string, unknown>
  if (typeof loc.City !== 'string') {
    return { valid: false, reason: 'Missing location.City' }
  }
  if (!Array.isArray(e.occurrences) || e.occurrences.length === 0) {
    return { valid: false, reason: 'Missing or empty occurrences' }
  }
  const occurrences = e.occurrences as unknown[]
  for (let i = 0; i < occurrences.length; i++) {
    const occ = occurrences[i]
    if (!occ || typeof occ !== 'object') {
      return { valid: false, reason: `occurrences[${i}] is not an object` }
    }
    const o = occ as Record<string, unknown>
    if (typeof o.date !== 'string' || !o.date.trim()) {
      return { valid: false, reason: `occurrences[${i}].date missing or empty` }
    }
    if (!YYYY_MM_DD.test(String(o.date).trim().slice(0, 10))) {
      return { valid: false, reason: `occurrences[${i}].date must be YYYY-MM-DD` }
    }
    if (typeof o.hasTime !== 'boolean') {
      return { valid: false, reason: `occurrences[${i}].hasTime missing or not boolean` }
    }
    if (typeof o.startTime !== 'string' || !o.startTime.trim()) {
      return { valid: false, reason: `occurrences[${i}].startTime missing or empty` }
    }
    if (!ISO_DATETIME.test(String(o.startTime).trim())) {
      return { valid: false, reason: `occurrences[${i}].startTime must be ISO 8601 date-time` }
    }
    if (o.endTime != null && o.endTime !== '') {
      const endStr = String(o.endTime).trim()
      if (!ISO_DATETIME.test(endStr)) {
        return { valid: false, reason: `occurrences[${i}].endTime must be ISO 8601 or null` }
      }
      const startMs = new Date(String(o.startTime)).getTime()
      const endMs = new Date(endStr).getTime()
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs <= startMs) {
        return { valid: false, reason: `occurrences[${i}].endTime must be after startTime` }
      }
    }
  }
  if (e.price !== null && (typeof e.price !== 'number' || !Number.isFinite(e.price))) {
    return { valid: false, reason: 'price must be number or null' }
  }
  return { valid: true }
}

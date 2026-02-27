/**
 * Occurrence normalization for publisher-formatted events.
 * Shared by formatPublisherEvent and extractEventFromFreeText.
 */
import { israelMidnightToUtcIso, localTimeIsraelToUtcIso } from './israelDate.js'

const SERVER_ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/i
const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/
const HH_MM_REGEX = /(\d{1,2}):(\d{2})/

/**
 * Extract HH:mm from a string (e.g. "18:00", "16:00:00", "8:30").
 * Returns null when no valid time (0-23 hour, 0-59 min) is found.
 * @param {string} s - Input string
 * @returns {string|null} "HH:mm" or null
 */
function extractHHMMFromString(s) {
  if (s == null || typeof s !== 'string') return null
  const match = s.trim().match(HH_MM_REGEX)
  if (!match) return null
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function normalizeOccurrenceTime(s) {
  if (s == null || typeof s !== 'string') return s
  let trimmed = s.trim().replace(/\s+/, 'T')
  if (!trimmed) return s
  if (SERVER_ISO_DATETIME.test(trimmed)) return trimmed
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(\.[0-9]+)?(Z|[+-]\d{2}:?\d{2})?$/i)
  if (match) {
    const datePart = match[1]
    const hh = match[2]
    const mm = match[3]
    const ss = match[4] || '00'
    const frac = match[5] || ''
    const tz = match[6] || 'Z'
    return `${datePart}T${hh}:${mm}:${ss}${frac}${tz}`
  }
  const dateOnlyMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/)
  if (dateOnlyMatch) {
    const iso = israelMidnightToUtcIso(dateOnlyMatch[1])
    if (iso) return iso
  }
  const d = new Date(trimmed)
  if (!Number.isNaN(d.getTime())) return d.toISOString()
  return s
}

/**
 * Normalize occurrences for publisher-formatted event validation.
 * Ensures startTime/endTime are valid ISO 8601; fixes common AI output issues.
 * When hasTime is true but startTime is invalid (e.g. time-only "18:00"), extracts HH:mm and combines with date.
 * When rawOccurrences is provided and single occurrence, uses it as fallback for time extraction.
 * @param {Array<{ date?: string, hasTime?: boolean, startTime?: string, endTime?: string|null }>} occurrences
 * @param {string} [rawOccurrences] - Optional combined date/time string (e.g. "28.2.26 18:00") for single-occurrence fallback
 * @returns {Array<{ date: string, hasTime: boolean, startTime: string, endTime: string|null }>}
 */
export function normalizeFormattedEventOccurrences(occurrences, rawOccurrences) {
  if (!Array.isArray(occurrences) || occurrences.length === 0) return []
  const singleOccurrence = occurrences.length === 1
  const rawOccStr = typeof rawOccurrences === 'string' ? rawOccurrences.trim() : ''
  return occurrences
    .map((occ) => {
      if (!occ || typeof occ !== 'object') return null
      const dateStr = typeof occ.date === 'string' ? occ.date.trim().slice(0, 10) : ''
      let startIso = normalizeOccurrenceTime(occ.startTime)
      if (!startIso || !SERVER_ISO_DATETIME.test(String(startIso).trim())) {
        if (YYYY_MM_DD.test(dateStr)) {
          if (occ.hasTime === false) {
            startIso = israelMidnightToUtcIso(dateStr)
          } else {
            const timeFromStart = extractHHMMFromString(occ.startTime)
            const timeToUse = timeFromStart ?? (singleOccurrence && rawOccStr ? extractHHMMFromString(rawOccStr) : null)
            const fallbackTime = timeToUse || '00:00'
            startIso = localTimeIsraelToUtcIso(dateStr, fallbackTime) || israelMidnightToUtcIso(dateStr)
          }
        }
        if (!startIso) return null
      }
      let endTime = occ.endTime != null && occ.endTime !== '' ? normalizeOccurrenceTime(occ.endTime) : null
      if (endTime && startIso) {
        const startMs = new Date(startIso).getTime()
        const endMs = new Date(endTime).getTime()
        if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs <= startMs) endTime = null
      } else {
        endTime = null
      }
      return {
        date: dateStr || (startIso ? startIso.slice(0, 10) : ''),
        hasTime: occ.hasTime === true,
        startTime: startIso,
        endTime,
      }
    })
    .filter(Boolean)
}

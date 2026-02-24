/**
 * Israel (Asia/Jerusalem) date/time helpers — no dependencies, shared by Nuxt app, server API, and wa-bot.
 * DST-aware via Intl (same logic as apps/wa-listener/src/utils/israelTime.js).
 */

const TIMEZONE_ISRAEL = 'Asia/Jerusalem'

/**
 * Returns current Israel UTC offset in hours (2 or 3). Use for prompts and conversion hints.
 * @returns {number} 2 (winter) or 3 (summer DST)
 */
export function getCurrentIsraelUtcOffset() {
  const now = new Date()
  const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0)
  const israelHour = parseInt(
    new Date(utc).toLocaleString('en-US', { timeZone: TIMEZONE_ISRAEL, hour: '2-digit', hour12: false }),
    10
  )
  return israelHour - 12
}

/**
 * Returns ISO UTC string for Israel midnight on the given date (YYYY-MM-DD).
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string} ISO UTC string
 */
export function israelMidnightToUtcIso(dateStr) {
  const match = (typeof dateStr === 'string' ? dateStr.slice(0, 10) : '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return dateStr
  const [, y, m, d] = match.map(Number)
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const israelHour = parseInt(
    noonUtc.toLocaleString('en-US', { timeZone: TIMEZONE_ISRAEL, hour: '2-digit', hour12: false }),
    10
  )
  const offsetHours = israelHour - 12
  const utcIsraelMidnight = new Date(Date.UTC(y, m - 1, d) - offsetHours * 3600 * 1000)
  return utcIsraelMidnight.toISOString()
}

/**
 * Returns ISO UTC string for a given date and time in Israel.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} timeHHMM - HH:MM or H:MM (Israel local)
 * @returns {string} ISO UTC string or empty string if invalid
 */
export function localTimeIsraelToUtcIso(dateStr, timeHHMM) {
  const dateMatch = (dateStr || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const timeMatch = (timeHHMM || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!dateMatch || !timeMatch) return ''
  const [, y, mo, d] = dateMatch.map(Number)
  const [, h, min] = timeMatch.map(Number)
  if (h < 0 || h > 23 || min < 0 || min > 59) return ''
  const noonUtc = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0))
  const israelHour = parseInt(
    noonUtc.toLocaleString('en-US', { timeZone: TIMEZONE_ISRAEL, hour: '2-digit', hour12: false }),
    10
  )
  const offsetHours = israelHour - 12
  const utcMoment = new Date(Date.UTC(y, mo - 1, d, h, min, 0) - offsetHours * 3600 * 1000)
  return utcMoment.toISOString()
}

/**
 * Returns YYYY-MM-DD in Israel for an ISO date-time string.
 * @param {string} isoString - ISO date-time string
 * @returns {string|null} YYYY-MM-DD or null
 */
export function getDateInIsraelFromIso(isoString) {
  if (!isoString || typeof isoString !== 'string') return null
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return null
  const formatted = d.toLocaleDateString('en-CA', {
    timeZone: TIMEZONE_ISRAEL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatted.split('-')
  if (parts.length !== 3) return null
  return `${parts[0]}-${parts[1]}-${parts[2]}`
}

/**
 * Returns time as "HH:mm" in Israel for an ISO date-time string.
 * @param {string} isoString - ISO date-time string
 * @returns {string} "HH:mm" or ""
 */
export function getTimeInIsraelFromIso(isoString) {
  if (!isoString || typeof isoString !== 'string') return ''
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return ''
  const hours = d.toLocaleString('en-US', { timeZone: TIMEZONE_ISRAEL, hour: '2-digit', hour12: false })
  const minutes = d.toLocaleString('en-US', { timeZone: TIMEZONE_ISRAEL, minute: '2-digit' })
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/**
 * Today or tomorrow in Israel as YYYY-MM-DD.
 * @param {'today'|'tomorrow'} choice
 * @returns {string} YYYY-MM-DD
 */
export function getDateIsrael(choice) {
  const now = new Date()
  const dayOffset = choice === 'tomorrow' ? 1 : 0
  const d = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE_ISRAEL }))
  d.setDate(d.getDate() + dayOffset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

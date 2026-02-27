/**
 * Israel (Asia/Jerusalem) date/time helpers. No dependencies.
 * DST-aware via Intl.
 */
const TIMEZONE_ISRAEL = 'Asia/Jerusalem'

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
 * @returns {string|null} ISO UTC string or null if invalid
 */
export function israelMidnightToUtcIso(dateStr) {
  const match = (typeof dateStr === 'string' ? dateStr.slice(0, 10) : '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
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

/**
 * Israel (Asia/Jerusalem) date/time helpers — no dependencies, shared by Nuxt app, server API, and wa-bot.
 */

const TIMEZONE_ISRAEL = 'Asia/Jerusalem'

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

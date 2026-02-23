import { HEBREW_MONTHS, HEBREW_WEEKDAYS } from '~/consts/dates.const'
import { getDateInIsraelFromIso, getTimeInIsraelFromIso, getDateIsrael } from './israelDate'

export { getDateInIsraelFromIso, getTimeInIsraelFromIso, getDateIsrael }

/**
 * Format a Date object to YYYY-MM-DD string
 * @param {Date} date - Date object to format
 * @returns {string} Formatted date string
 */
export function formatDateToYYYYMMDD(date) {
  if (!(date instanceof Date) || isNaN(date)) {
    throw new Error('Invalid date provided to formatDateToYYYYMMDD')
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse a date string in YYYY-MM-DD format to a Date object
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {Date} Parsed date object
 */
export function parseDateString(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    throw new Error('Invalid date string provided to parseDateString')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error('Date string must be in YYYY-MM-DD format')
  }
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  // Validate that the parsed date matches the input (catches invalid dates like Feb 31)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error(`Invalid date: ${dateString}`)
  }
  return date
}

/**
 * Gets today's date as YYYY-MM-DD string
 * @returns {string} Today's date in YYYY-MM-DD format
 */
export function getTodayDateString() {
  const today = new Date()
  return formatDateToYYYYMMDD(today)
}

/**
 * Gets current year and month
 * @returns {{year: number, month: number}} Current year and month (month is 1-indexed)
 */
export function getCurrentYearMonth() {
  const today = new Date()
  return {
    year: today.getFullYear(),
    month: today.getMonth() + 1, // 1-indexed
  }
}

/**
 * Formats month and year for display (e.g., "פברואר 2026")
 * @param {number} year - Year
 * @param {number} month - Month (1-12, 1-indexed)
 * @returns {string} Formatted month year string
 */
export function formatMonthYear(year, month) {
  const monthName = HEBREW_MONTHS[month - 1]
  return `${monthName} ${year}`
}

/**
 * Gets the previous month and year
 * @param {number} year - Current year
 * @param {number} month - Current month (1-12, 1-indexed)
 * @returns {{year: number, month: number}} Previous month and year
 */
export function getPrevMonth(year, month) {
  let newMonth = month - 1
  let newYear = year

  if (newMonth < 1) {
    newMonth = 12
    newYear--
  }

  return { year: newYear, month: newMonth }
}

/**
 * Gets the next month and year
 * @param {number} year - Current year
 * @param {number} month - Current month (1-12, 1-indexed)
 * @returns {{year: number, month: number}} Next month and year
 */
export function getNextMonth(year, month) {
  let newMonth = month + 1
  let newYear = year

  if (newMonth > 12) {
    newMonth = 1
    newYear++
  }

  return { year: newYear, month: newMonth }
}

/**
 * Returns true if month a is strictly before month b (a < b)
 * @param {{ year: number, month: number }} a - First month (month 1-12)
 * @param {{ year: number, month: number }} b - Second month (month 1-12)
 * @returns {boolean}
 */
export function isMonthBefore(a, b) {
  if (!a || !b) return false
  return a.year < b.year || (a.year === b.year && a.month < b.month)
}

/**
 * Validates if a month is valid (1-12)
 * @param {number} month - Month to validate
 * @returns {boolean} True if month is valid
 */
export function isValidMonth(month) {
  return Number.isInteger(month) && month >= 1 && month <= 12
}

/**
 * Validates if a year is reasonable (1900-2100)
 * @param {number} year - Year to validate
 * @returns {boolean} True if year is valid
 */
export function isValidYear(year) {
  return Number.isInteger(year) && year >= 1900 && year <= 2100
}

/**
 * Gets the next day as YYYY-MM-DD string
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} Next day in YYYY-MM-DD format
 */
export function getNextDay(dateString) {
  const date = new Date(dateString + 'T00:00:00')
  date.setDate(date.getDate() + 1)
  return formatDateToYYYYMMDD(date)
}

/**
 * Gets the previous day as YYYY-MM-DD string
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} Previous day in YYYY-MM-DD format
 */
export function getPrevDay(dateString) {
  const date = new Date(dateString + 'T00:00:00')
  date.setDate(date.getDate() - 1)
  return formatDateToYYYYMMDD(date)
}

/**
 * Checks if a date string is today
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {boolean} True if date is today
 */
export function isToday(dateString) {
  return dateString === getTodayDateString()
}

/**
 * Checks if a date is before today
 * @param {Date} date - Date object to check
 * @returns {boolean} True if date is before today
 */
export function isBeforeToday(date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const checkDate = new Date(date)
  checkDate.setHours(0, 0, 0, 0)
  return checkDate < today
}

/**
 * Formats date for kanban column header (e.g., "שני, 20.2")
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string (weekday, day.month)
 */
export function formatKanbanDateHeader(dateString) {
  const date = parseDateString(dateString)
  const weekday = HEBREW_WEEKDAYS[date.getDay()]
  const day = date.getDate()
  const month = date.getMonth() + 1
  return `${weekday}, ${day}.${month}`
}

/**
 * Formats date for event modal (e.g., "יום רביעי, 22.4")
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string (יום weekday, day.month) or '' if invalid
 */
export function formatEventDateAndDay(dateString) {
  if (!dateString || typeof dateString !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) {
    return ''
  }
  try {
    const date = parseDateString(dateString.trim().slice(0, 10))
    const weekday = HEBREW_WEEKDAYS[date.getDay()]
    const day = date.getDate()
    const month = date.getMonth() + 1
    return `יום ${weekday}, ${day}.${month}`
  } catch {
    return ''
  }
}

/**
 * Format minutes from midnight (0–1440) as "HH:MM"
 * @param {number} minutes - Minutes from midnight
 * @returns {string} Formatted time string
 */
export function formatMinutesToTime(minutes) {
  const h = Math.floor(minutes / 60)
  const m = Math.floor(minutes % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Checks whether two month/year objects represent the same month.
 * @param {{ year: number, month: number } | null | undefined} a
 * @param {{ year: number, month: number } | null | undefined} b
 * @returns {boolean}
 */
export function isSameMonth(a, b) {
  return !!(a && b && a.year === b.year && a.month === b.month)
}


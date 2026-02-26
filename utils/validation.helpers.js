import { parseDateString } from './date.helpers'
import { MINUTES_PER_DAY } from '~/consts/calendar.const'
import { REGION_KEYS } from '~/consts/regions.const'

/**
 * Validates if a string matches YYYY-MM-DD format
 * @param {string} dateString - Date string to validate
 * @returns {boolean} - True if valid format
 */
export function isValidDateString(dateString) {
  if (!dateString || typeof dateString !== 'string') return false

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dateString)) return false

  try {
    // Use shared parser and validate the date components match
    const date = parseDateString(dateString)
    const [year, month, day] = dateString.split('-').map(Number)
    
    // Check if the date components match (handles invalid dates like Feb 31)
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    )
  } catch {
    return false
  }
}

/**
 * Validates route date parameter
 * @param {string} dateParam - Route param to validate
 * @returns {boolean} - True if valid
 */
export function isValidRouteDate(dateParam) {
  return isValidDateString(dateParam)
}

/**
 * Parse categories from URL query parameter
 * @param {string} queryParam - Comma-separated category IDs
 * @returns {string[]} - Array of category IDs
 */
export function parseCategories(queryParam) {
  if (!queryParam) return []
  return queryParam.split(',').filter(Boolean)
}

/**
 * Serialize categories to URL query parameter
 * @param {string[]} categories - Array of category IDs
 * @returns {string|undefined} - Comma-separated string or undefined if empty
 */
export function serializeCategories(categories) {
  return categories.length > 0 ? categories.join(',') : undefined
}

/**
 * Parse regions from URL query parameter (valid keys only)
 * @param {string} queryParam - Comma-separated region keys
 * @returns {string[]} - Array of valid region keys
 */
export function parseRegions(queryParam) {
  if (!queryParam) return []
  return queryParam.split(',').filter((key) => REGION_KEYS.includes(key.trim()))
}

/**
 * Serialize regions to URL query parameter
 * @param {string[]} regions - Array of region keys
 * @returns {string|undefined} - Comma-separated string or undefined if empty
 */
export function serializeRegions(regions) {
  return regions && regions.length > 0 ? regions.join(',') : undefined
}

/**
 * Parse and validate time filter values from URL
 * @param {string|number} start - Start time in minutes
 * @param {string|number} end - End time in minutes
 * @returns {{start: number, end: number}} - Validated time range
 */
export function parseTimeFilter(start, end) {
  const startNum = parseInt(start)
  const endNum = parseInt(end)
  
  const validStart = !isNaN(startNum) && startNum >= 0 && startNum <= MINUTES_PER_DAY
  const validEnd = !isNaN(endNum) && endNum >= 0 && endNum <= MINUTES_PER_DAY
  
  return {
    start: validStart ? startNum : 0,
    end: validEnd ? endNum : MINUTES_PER_DAY,
  }
}

/**
 * Validate if a year/month combination is valid (not before current month)
 * @param {number} year - Year value
 * @param {number} month - Month value (1-12)
 * @returns {boolean} - True if valid
 */
export function isValidMonthYear(year, month) {
  if (!year || !month || month < 1 || month > 12) return false
  
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  
  // Check if the selected month is not before current month
  if (year < currentYear) return false
  if (year === currentYear && month < currentMonth) return false
  
  return true
}

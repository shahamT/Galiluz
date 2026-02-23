import {
  MAX_EVENTS_TO_DISPLAY,
  MAX_REGULAR_CHIPS,
  MAX_EVENTS_TO_DISPLAY_MOBILE,
  MAX_REGULAR_CHIPS_MOBILE,
  WEEKEND_DAYS,
  MORE_EVENTS_TEXT,
} from '~/consts/calendar.const'

/**
 * Gets events to display in calendar day cell with "more" chip logic
 * @param {Array} events - Array of event objects
 * @param {number} totalCount - Total number of events for the day
 * @param {boolean} [isMobile] - Whether to use mobile chip text format ("x+"); same slot count as desktop (3, 3rd is "+N" when more)
 * @returns {Array} Array of events to display, with optional "more" chip object
 */
export function getDisplayEvents(events, totalCount, isMobile = false) {
  if (!events || totalCount === 0) {
    return []
  }

  const maxDisplay = isMobile ? MAX_EVENTS_TO_DISPLAY_MOBILE : MAX_EVENTS_TO_DISPLAY
  const maxRegular = isMobile ? MAX_REGULAR_CHIPS_MOBILE : MAX_REGULAR_CHIPS
  const eventsToShow = []

  if (totalCount <= maxDisplay) {
    eventsToShow.push(...events.slice(0, totalCount))
  } else {
    eventsToShow.push(...events.slice(0, maxRegular))
    eventsToShow.push({ isMore: true })
  }

  return eventsToShow
}

/**
 * Calculates the count of additional events for the "more" chip
 * @param {number} totalCount - Total number of events for the day
 * @param {boolean} [isMobile] - Whether to use mobile limits
 * @returns {number} Number of additional events (0 if no "more" chip needed)
 */
export function getAdditionalEventsCount(totalCount, isMobile = false) {
  const maxDisplay = isMobile ? MAX_EVENTS_TO_DISPLAY_MOBILE : MAX_EVENTS_TO_DISPLAY
  if (totalCount <= maxDisplay) {
    return 0
  }
  const maxRegular = isMobile ? MAX_REGULAR_CHIPS_MOBILE : MAX_REGULAR_CHIPS
  return totalCount - maxRegular
}

/**
 * Checks if a date is a weekend day (Friday or Saturday)
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {boolean} True if the date is Friday or Saturday
 */
export function isWeekendDay(dateString) {
  if (!dateString) {
    return false
  }
  const date = new Date(dateString)
  const dayOfWeek = date.getDay()
  return WEEKEND_DAYS.includes(dayOfWeek)
}

/**
 * Gets the color for a category with fallback
 * @param {string} categoryId - Category ID
 * @param {Object} categories - Categories object with categoryId as keys
 * @param {string} fallbackColor - Fallback color if category not found
 * @returns {string} Category color or fallback color
 */
export function getCategoryColor(categoryId, categories, fallbackColor = 'var(--brand-dark-blue)') {
  if (!categoryId || !categories || !categories[categoryId]) {
    return fallbackColor
  }
  return categories[categoryId].color || fallbackColor
}

/**
 * Returns category IDs with main category first (for RTL: main appears on the right), then the rest in original order.
 * @param {string[]} categoryIds - Array of category IDs (e.g. event.categories)
 * @param {string} [mainCategoryId] - Main category ID (e.g. event.mainCategory)
 * @returns {string[]} Sorted array: [main, ...rest]
 */
export function sortCategoryIdsWithMainFirst(categoryIds, mainCategoryId) {
  if (!categoryIds?.length) return []
  if (!mainCategoryId) return [...categoryIds]
  const rest = categoryIds.filter((id) => id !== mainCategoryId)
  return [mainCategoryId, ...rest]
}

/**
 * Gets the text for the "more" events chip
 * @param {number} additionalCount - Number of additional events (total − 2 when "more" chip shown; same for desktop and mobile)
 * @param {boolean} isMobile - Whether to use mobile format ("x+" where x is additionalCount)
 * @returns {string} Formatted text for the "more" chip
 */
export function getMoreEventsText(additionalCount, isMobile = false) {
  if (isMobile) {
    return `${additionalCount}+`
  }
  return MORE_EVENTS_TEXT(additionalCount)
}

import {
  filterEventsByCategories,
  filterEventsByRegions,
  filterEventsByTimeRangeForMonth,
  getEventsForDate,
  eventMatchesCategories,
  eventMatchesRegions,
  filterEventOccurrencesByTimeRange,
} from '~/utils/events.service'
import { transformEventForCard, formatEventLocationForChip } from '~/utils/events.helpers'

/**
 * Composable for filtering events by categories and time range
 * Centralizes all event filtering logic used across monthly and daily views
 *
 * @param {import('vue').Ref<Array>} events - Reactive ref containing all events data (Event shape per types/events.d.ts)
 * @returns {{ getFilteredEventsForMonth: Function, getFilteredEventsForDate: Function, getFilteredEventsByDate: Function }}
 */
export const useEventFilters = (events) => {
  const calendarStore = useCalendarStore()
  const { selectedCategories, selectedRegions, timeFilterStart, timeFilterEnd } = storeToRefs(calendarStore)

  /**
   * Get events filtered by categories and time range for a specific month
   * @param {number} year - The year
   * @param {number} month - The month (1-12)
   * @returns {Array} Filtered events
   */
  const getFilteredEventsForMonth = (year, month) => {
    let allEvents = events.value

    if (selectedCategories.value.length > 0) {
      allEvents = filterEventsByCategories(allEvents, selectedCategories.value)
    }
    if (selectedRegions.value.length > 0) {
      allEvents = filterEventsByRegions(allEvents, selectedRegions.value)
    }

    return filterEventsByTimeRangeForMonth(
      allEvents,
      year,
      month,
      timeFilterStart.value,
      timeFilterEnd.value
    )
  }

  /**
   * Get filtered event occurrences for a specific date
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @returns {Array} Array of {event, occurrence} pairs filtered and transformed
   */
  const getFilteredEventsForDate = (dateString) => {
    const categories = selectedCategories.value
    const regions = selectedRegions.value
    const startMin = timeFilterStart.value
    const endMin = timeFilterEnd.value

    let pairs = getEventsForDate(events.value, dateString)

    if (categories.length > 0) {
      pairs = pairs.filter(({ event }) => eventMatchesCategories(event, categories))
    }
    if (regions.length > 0) {
      pairs = pairs.filter(({ event }) => eventMatchesRegions(event, regions))
    }

    return filterEventOccurrencesByTimeRange(pairs, startMin, endMin)
  }

  /**
   * Get filtered events by date for multiple dates (used in daily view carousel)
   * Returns transformed event cards with timeText, title, desc, price for display
   * @param {Array<string>} dates - Array of date strings in YYYY-MM-DD format
   * @returns {Object} Map of date string to array of transformed event card objects
   */
  const getFilteredEventsByDate = (dates) => {
    const result = {}

    dates.forEach((date) => {
      const pairs = getFilteredEventsForDate(date)
      const sorted = [...pairs].sort((a, b) => {
        const aStart = a.occurrence?.startTime || ''
        const bStart = b.occurrence?.startTime || ''
        return aStart.localeCompare(bStart)
      })

      result[date] = sorted.map(({ event, occurrence }) => ({
        ...transformEventForCard(event, occurrence),
        id: event.id,
        eventId: event.id,
        mainCategory: event.mainCategory,
        categories: event.categories ?? [],
        locationDisplay: formatEventLocationForChip(event),
      }))
    })

    return result
  }

  return {
    getFilteredEventsForMonth,
    getFilteredEventsForDate,
    getFilteredEventsByDate,
  }
}

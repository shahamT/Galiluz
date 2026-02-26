/**
 * Event domain logic: filtering, flattening by occurrence, date/active and category/time-range filtering.
 */
import { MINUTES_PER_DAY } from '~/consts/calendar.const'
import { getDateInIsraelFromIso } from './israelDate'
import { formatDateToYYYYMMDD } from './date.helpers'

/**
 * Filters events to only active ones
 * @param {Array} events - Array of events
 * @returns {Array} Array of active events
 */
export function getActiveEvents(events) {
  return events.filter((event) => event.isActive === true)
}

/**
 * Converts ISO string to YYYY-MM-DD format
 * @param {string} isoString - ISO date string
 * @returns {string|null} Date string in YYYY-MM-DD format or null
 */
export function getDateFromISO(isoString) {
  if (!isoString) return null
  const date = new Date(isoString)
  return formatDateToYYYYMMDD(date)
}

/**
 * Gets the calendar date (YYYY-MM-DD) for an event.
 * Works for both API-shaped events (with occurrences array) and flat events (date/startTime at top level).
 * @param {Object} event - Event object with date and/or startTime (at top level or on occurrence)
 * @returns {string|null} Date string in YYYY-MM-DD format or null
 */
export function getEventDateString(event) {
  if (!event) return null
  if (event.date && /^\d{4}-\d{2}-\d{2}$/.test(String(event.date).trim().slice(0, 10))) {
    return String(event.date).trim().slice(0, 10)
  }
  if (event.startTime) {
    return getDateInIsraelFromIso(event.startTime) || null
  }
  return null
}

/**
 * Flattens events so each occurrence becomes a separate event object with occurrence keys at top level.
 * Used after fetching from API so the rest of the app works with one event per occurrence.
 * @param {Array} events - Array of events from API (each may have occurrences array)
 * @returns {Array} Array of flat events (one per occurrence), each with id, sourceEventId, date, hasTime, startTime, endTime at top level
 */
export function flattenEventsByOccurrence(events) {
  if (!Array.isArray(events)) return []
  const result = []
  for (const event of events) {
    const occurrences = event.occurrences && Array.isArray(event.occurrences) ? event.occurrences : []
    if (occurrences.length === 0) continue
    const { occurrences: _occ, ...eventRest } = event
    for (let i = 0; i < occurrences.length; i++) {
      const occ = occurrences[i]
      result.push({
        ...eventRest,
        ...occ,
        id: `${event.id}-${i}`,
        sourceEventId: event.id,
      })
    }
  }
  return result
}

/**
 * Gets event occurrences that match a specific date.
 * For flat events (one occurrence per event), returns [event] if its date matches, else [].
 * @param {Object} event - Event object (flat: date/startTime at top level, or legacy: occurrences array)
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {Array} Array of matching occurrences (for flat events, 0 or 1 element)
 */
export function getEventOccurrencesOnDate(event, dateString) {
  const eventDate = getEventDateString(event)
  if (!eventDate) return []
  return eventDate === dateString ? [event] : []
}

/**
 * Gets all events that occur on a specific date.
 * For flat events, each event is one occurrence; returns { event, occurrence: event } for each match.
 * @param {Array} events - Array of events (flat: one event per occurrence)
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {Array} Array of {event, occurrence} objects
 */
export function getEventsForDate(events, dateString) {
  const activeEvents = getActiveEvents(events)
  const eventsOnDate = []
  activeEvents.forEach((event) => {
    const matchingOccurrences = getEventOccurrencesOnDate(event, dateString)
    if (matchingOccurrences.length > 0) {
      matchingOccurrences.forEach((occurrence) => {
        eventsOnDate.push({ event, occurrence })
      })
    }
  })
  return eventsOnDate
}

/**
 * Gets event data grouped by date for a specific month.
 * For flat events, each event has one date at top level; group by that date.
 * @param {Array} events - Array of events (flat: one event per occurrence)
 * @param {number} year - Year (e.g., 2026)
 * @param {number} month - Month (1-12, 1-indexed)
 * @returns {Object} Map of date strings to arrays of event objects
 */
export function getEventsByDate(events, year, month) {
  const activeEvents = getActiveEvents(events)
  const eventsMap = {}
  activeEvents.forEach((event) => {
    const dateString = getEventDateString(event)
    if (!dateString) return
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) return
    const occurrenceYear = Number(match[1])
    const occurrenceMonth = Number(match[2])
    if (occurrenceYear === year && occurrenceMonth === month) {
      if (!eventsMap[dateString]) {
        eventsMap[dateString] = []
      }
      eventsMap[dateString].push(event)
    }
  })
  return eventsMap
}

/**
 * Checks if an event matches any of the given category IDs
 * @param {Object} event - Event object with categories array
 * @param {Array} categoryIds - Array of category IDs to match
 * @returns {boolean} True if event matches at least one category
 */
export function eventMatchesCategories(event, categoryIds) {
  if (!event.categories || !Array.isArray(event.categories)) {
    return false
  }
  return event.categories.some((categoryId) => categoryIds.includes(categoryId))
}

/**
 * Check if event matches region filter. When event has no region, include it (show until data exists).
 * @param {Object} event - Event object with optional location.region
 * @param {string[]} regionKeys - Array of region keys to filter by
 * @returns {boolean} - True if event matches
 */
export function eventMatchesRegions(event, regionKeys) {
  if (!regionKeys || regionKeys.length === 0) return true
  const eventRegion = event?.location?.region
  if (!eventRegion) return true
  return regionKeys.includes(eventRegion)
}

/**
 * Filters events by region keys
 * @param {Array} events - Array of events
 * @param {Array} regionKeys - Array of region keys to filter by
 * @returns {Array} Filtered array of events
 */
export function filterEventsByRegions(events, regionKeys) {
  if (!Array.isArray(events) || !Array.isArray(regionKeys) || regionKeys.length === 0) {
    return events
  }
  return events.filter((event) => eventMatchesRegions(event, regionKeys))
}

/**
 * Filters events by category IDs (checks all categories in event)
 * @param {Array} events - Array of events
 * @param {Array} categoryIds - Array of category IDs to filter by
 * @returns {Array} Filtered array of events
 */
export function filterEventsByCategories(events, categoryIds) {
  if (!Array.isArray(events) || !Array.isArray(categoryIds) || categoryIds.length === 0) {
    return events
  }

  return events.filter((event) => eventMatchesCategories(event, categoryIds))
}

/**
 * Get occurrence time as minutes from midnight (local time). All-day or no time = 0-1440.
 * @param {Object} occurrence - Occurrence with startTime, endTime, hasTime
 * @returns {{ startMinutes: number, endMinutes: number }}
 */
export function getOccurrenceMinutesOfDay(occurrence) {
  if (!occurrence.hasTime || !occurrence.startTime) {
    return { startMinutes: 0, endMinutes: MINUTES_PER_DAY }
  }
  const startDate = new Date(occurrence.startTime)
  const startMinutes = startDate.getHours() * 60 + startDate.getMinutes()
  if (!occurrence.endTime) {
    return { startMinutes, endMinutes: startMinutes }
  }
  const endDate = new Date(occurrence.endTime)
  const endMinutes = endDate.getHours() * 60 + endDate.getMinutes()
  return { startMinutes, endMinutes }
}

/**
 * Check if an occurrence's time overlaps a range [rangeStart, rangeEnd) (minutes from midnight).
 * @param {Object} occurrence
 * @param {number} rangeStartMinutes
 * @param {number} rangeEndMinutes
 * @returns {boolean}
 */
export function occurrenceOverlapsTimeRange(occurrence, rangeStartMinutes, rangeEndMinutes) {
  const { startMinutes, endMinutes } = getOccurrenceMinutesOfDay(occurrence)
  return startMinutes < rangeEndMinutes && endMinutes > rangeStartMinutes
}

/**
 * Filter events to those with at least one occurrence in the given month overlapping the time range.
 * For flat events, each event is one occurrence; filter by event's date and time range.
 * No filter when startMinutes === 0 && endMinutes === 1440.
 * @param {Array} events - Array of events (flat: one event per occurrence)
 * @param {number} year
 * @param {number} month - 1-indexed
 * @param {number} startMinutes
 * @param {number} endMinutes
 * @returns {Array}
 */
export function filterEventsByTimeRangeForMonth(events, year, month, startMinutes, endMinutes) {
  if (startMinutes === 0 && endMinutes === MINUTES_PER_DAY) {
    return events
  }
  const activeEvents = getActiveEvents(events)
  return activeEvents.filter((event) => {
    const dateString = getEventDateString(event)
    if (!dateString) return false
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) return false
    const occYear = Number(match[1])
    const occMonth = Number(match[2])
    if (occYear !== year || occMonth !== month) return false
    return occurrenceOverlapsTimeRange(event, startMinutes, endMinutes)
  })
}

/**
 * Filter { event, occurrence } pairs to those whose occurrence overlaps the time range.
 * No filter when startMinutes === 0 && endMinutes === 1440.
 * @param {Array} pairs - Array of { event, occurrence }
 * @param {number} startMinutes
 * @param {number} endMinutes
 * @returns {Array}
 */
export function filterEventOccurrencesByTimeRange(pairs, startMinutes, endMinutes) {
  if (startMinutes === 0 && endMinutes === MINUTES_PER_DAY) {
    return pairs
  }
  return pairs.filter(({ occurrence }) =>
    occurrenceOverlapsTimeRange(occurrence, startMinutes, endMinutes)
  )
}

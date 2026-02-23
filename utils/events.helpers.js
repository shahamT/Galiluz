/**
 * Event display formatting and transformation (time, price, location, card shape).
 * Note: formatDateToYYYYMMDD and parseDateString live in date.helpers.js - import from there
 */

import { getTimeInIsraelFromIso } from '~/utils/israelDate'

const ALL_DAY_TEXT = 'כל היום'
const FREE_TEXT = 'חינם'
const PRICE_UNKNOWN_TEXT = 'מחיר לא ידוע'
const UNKNOWN_LOCATION_TEXT = 'לא ידוע'

export { PRICE_UNKNOWN_TEXT }

/**
 * Format event occurrence time for display (e.g. event modal).
 * Shows start time only, or "HH:mm-HH:mm" range when end time is present.
 * @param {Object} occurrence - Event occurrence with startTime, endTime, hasTime
 * @returns {string} Start time (e.g. "10:00"), range (e.g. "10:00-11:00"), "כל היום", or ""
 */
export function formatEventTime(occurrence) {
  if (!occurrence.hasTime) {
    return ALL_DAY_TEXT
  }

  if (!occurrence.startTime) {
    return ''
  }

  const startTime = getTimeInIsraelFromIso(occurrence.startTime)
  if (!startTime) return ''

  if (occurrence.endTime) {
    const endTime = getTimeInIsraelFromIso(occurrence.endTime)
    if (endTime) return `${startTime}-${endTime}`
  }

  return startTime
}

/**
 * Format event price for display
 * @param {Object} event - Event object with price property
 * @returns {string} Formatted price string, "חינם" for free (0), or "מחיר לא ידוע" when price is unknown
 */
export function formatEventPrice(event) {
  if (event.price === null || event.price === undefined) {
    return PRICE_UNKNOWN_TEXT
  }
  if (event.price === 0) {
    return FREE_TEXT
  }
  return `${event.price} ₪`
}

/**
 * Format event location for display
 * @param {Object} event - Event object with location property
 * @returns {string} Formatted location string (city, address) or empty string
 */
export function formatEventLocation(event) {
  if (!event.location) return ''

  const parts = []
  if (event.location.city) parts.push(event.location.city)
  if (event.location.addressLine1) parts.push(event.location.addressLine1)

  return parts.join(', ')
}

/**
 * Format event location for the Kanban card location chip
 * @param {Object} event - Event object with location property
 * @returns {string} "name - city", "city", "name", or "לא ידוע"
 */
export function formatEventLocationForChip(event) {
  const loc = event?.location
  const name = loc?.addressLine1?.trim()
  const city = loc?.city?.trim()
  if (name && city) return `${name} - ${city}`
  if (city) return city
  if (name) return name
  return UNKNOWN_LOCATION_TEXT
}

/**
 * Transform event and occurrence into a card-friendly format
 * @param {Object} event - Event object
 * @param {Object} occurrence - Event occurrence object
 * @returns {Object} Transformed card data with timeText, title, desc, and price
 */
export function transformEventForCard(event, occurrence) {
  return {
    timeText: formatEventTime(occurrence),
    title: event.title,
    desc: event.shortDescription || event.fullDescription || '',
    price: [formatEventPrice(event), formatEventLocation(event)].filter(Boolean).join(' '),
  }
}

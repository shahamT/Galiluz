/**
 * Event display formatting and transformation (time, price, location, card shape).
 * Note: formatDateToYYYYMMDD and parseDateString live in date.helpers.js - import from there
 */

import { getTimeInIsraelFromIso } from '~/utils/israelDate'
import { CITIES } from '~/consts/regions.const.js'

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
 *
 * Note: a null/undefined price only occurs on LEGACY events — new events always store a number
 * (auto-extraction defaults to free/0 when it can't tell; the publisher form requires a price).
 * We still render null as "מחיר לא ידוע" so legacy data displays sensibly.
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
 * Resolve a stored city value to its display title.
 * Listed cities are stored as an English ID (e.g. "Gadot") → return the Hebrew title.
 * Already-resolved titles and custom city names are returned as-is, so this is
 * idempotent across both raw (publisher) and transformed (public feed) event data.
 * @param {string} city
 * @returns {string}
 */
export function resolveCityName(city) {
  if (!city) return ''
  return CITIES[city]?.title || city
}

/**
 * Format event location for display
 * @param {Object} event - Event object with location property
 * @returns {string} Formatted location string (venue, address, city) or empty string
 */
export function formatEventLocation(event) {
  if (!event.location) return ''

  const parts = []
  if (event.location.locationName) parts.push(event.location.locationName)
  if (event.location.addressLine1) parts.push(event.location.addressLine1)
  if (event.location.addressLine2) parts.push(event.location.addressLine2)
  const city = resolveCityName(event.location.city)
  if (city) parts.push(city)

  return parts.join(', ')
}

/**
 * Format event location for the Kanban card location chip
 * @param {Object} event - Event object with location property
 * @returns {string} "name - city", "city", "name", or "לא ידוע"
 */
export function formatEventLocationForChip(event) {
  const loc = event?.location
  const name = (loc?.locationName || loc?.addressLine1)?.trim()
  const city = resolveCityName(loc?.city)?.trim()
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

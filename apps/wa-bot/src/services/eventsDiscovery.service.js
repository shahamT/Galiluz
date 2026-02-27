import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'
import { CATEGORY_GROUPS, CATEGORY_ALL_ID } from '../consts/categories.const.js'
import { getDateInIsraelFromIso, getDateIsrael } from '../utils/date.helpers.js'
import { formatEventsListMessage } from '../utils/eventsMessageFormat.js'

function getEventDateString(flatEvent) {
  if (!flatEvent) return null
  if (flatEvent.date && /^\d{4}-\d{2}-\d{2}$/.test(String(flatEvent.date).trim().slice(0, 10))) {
    return String(flatEvent.date).trim().slice(0, 10)
  }
  if (flatEvent.startTime) return getDateInIsraelFromIso(flatEvent.startTime) || null
  return null
}

function flattenEventsByOccurrence(events) {
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

function getActiveEvents(events) {
  return events.filter((e) => e.isActive !== false)
}

function buildEventsApiUrl(dateString, categoryGroupId) {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  const params = new URLSearchParams()
  params.set('dates', dateString)
  if (categoryGroupId && categoryGroupId !== CATEGORY_ALL_ID) {
    const group = CATEGORY_GROUPS.find((g) => g.id === categoryGroupId)
    if (group?.categoryIds?.length) params.set('categories', group.categoryIds.join(','))
  }
  return `${baseUrl}/api/events?${params.toString()}`
}

/**
 * Fetch events from Galiluz API (filtered by date and optional category); flatten, filter to one day, sort, format message.
 * @param {string} dateString - YYYY-MM-DD (Israel)
 * @param {string} categoryGroupId - 'all' or one of CATEGORY_GROUPS[].id
 * @param {string} timeChoice - 'today' | 'tomorrow' for header label
 * @returns {Promise<string>} Message body to send
 */
export async function getEventsMessageForDateAndCategory(dateString, categoryGroupId, timeChoice) {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  const apiUrl = buildEventsApiUrl(dateString, categoryGroupId)
  const headers = { Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey

  let events
  try {
    const res = await fetch(apiUrl, { headers })
    if (!res.ok) {
      logger.error(LOG_PREFIXES.CLOUD_API, 'Events API failed', res.status)
      return 'לא הצלחתי לטעון אירועים כרגע. נסו שוב או כנסו ל־ https://galiluz.co.il'
    }
    events = await res.json()
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Events fetch error', err)
    return 'שגיאה בטעינת אירועים. נסו שוב או כנסו ל־ https://galiluz.co.il'
  }

  const flat = flattenEventsByOccurrence(getActiveEvents(events))
  const onDate = flat.filter((e) => getEventDateString(e) === dateString)
  onDate.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))

  const group = categoryGroupId && categoryGroupId !== CATEGORY_ALL_ID
    ? CATEGORY_GROUPS.find((g) => g.id === categoryGroupId)
    : null
  return formatEventsListMessage(dateString, timeChoice, categoryGroupId, onDate, baseUrl, group || undefined)
}

export { getDateIsrael }

import { getTimeInIsraelFromIso } from './date.helpers.js'

const ALL_DAY_TEXT = 'כל היום'
const UNKNOWN_LOCATION = 'לא ידוע'
const MAX_EVENTS_IN_MESSAGE = 15
const MORE_EVENTS_LINE = '\nלעוד אירועים כנסו ל־ https://galiluz.co.il'

/** Format YYYY-MM-DD as d.m (e.g. 23.2, 7.3) */
export function formatDateDotted(dateString) {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateString).trim().slice(0, 10))) return ''
  const [, year, month, day] = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/) || []
  if (!day) return ''
  return `${parseInt(day, 10)}.${parseInt(month, 10)}`
}

/**
 * Location line for event list: locationName and city only.
 * Uses whichever is present (one or both). No address lines.
 */
export function formatLocation(event) {
  if (!event?.location) return UNKNOWN_LOCATION
  const loc = event.location
  const parts = []
  if (loc.locationName?.trim()) parts.push(loc.locationName.trim())
  if (loc.city?.trim()) parts.push(loc.city.trim())
  return parts.length === 0 ? UNKNOWN_LOCATION : parts.join(', ')
}

/** Time string for one occurrence: "כל היום" or "HH:mm" or "HH:mm-HH:mm". */
export function formatEventTime(occurrence) {
  if (!occurrence.hasTime) return ALL_DAY_TEXT
  if (!occurrence.startTime) return ''
  const startTime = getTimeInIsraelFromIso(occurrence.startTime)
  if (!startTime) return ''
  if (occurrence.endTime) {
    const endTime = getTimeInIsraelFromIso(occurrence.endTime)
    if (endTime) return `${startTime}-${endTime}`
  }
  return startTime
}

/**
 * Build the WhatsApp message body for a list of events on one day.
 * @param {string} dateString - YYYY-MM-DD
 * @param {string} timeChoice - 'today' | 'tomorrow'
 * @param {string} categoryGroupId - 'all' or group id
 * @param {Array} onDateFlatEvents - Sorted flat events for that day
 * @param {string} baseUrl - Galiluz base URL
 * @param {Object} categoryGroup - Optional { label } for category header
 * @returns {string}
 */
export function formatEventsListMessage(
  dateString,
  timeChoice,
  categoryGroupId,
  onDateFlatEvents,
  baseUrl,
  categoryGroup,
) {
  const dDotM = formatDateDotted(dateString)
  const dayLabel = timeChoice === 'tomorrow' ? 'מחר' : 'היום'
  const lines = []
  lines.push(`הנה מה שקורה *${dayLabel}* (${dDotM}) בצפון -`)
  if (categoryGroupId && categoryGroupId !== 'all' && categoryGroup?.label) {
    lines.push(`*${categoryGroup.label}*`)
  }
  lines.push('')
  lines.push('')

  const take = Math.min(onDateFlatEvents.length, MAX_EVENTS_IN_MESSAGE)
  for (let i = 0; i < take; i++) {
    const flatEvent = onDateFlatEvents[i]
    const title = flatEvent.title || 'אירוע'
    const timeText = formatEventTime(flatEvent)
    const link = `${baseUrl}/daily-view?date=${dateString}&event=${flatEvent.id}`
    const location = formatLocation(flatEvent)
    lines.push(`✅ *${title}*`)
    lines.push(`איפה: ${location}`)
    lines.push(`מתי: ${timeText}`)
    lines.push(link)
    lines.push('')
  }

  if (onDateFlatEvents.length === 0) {
    return `אין אירועים ביום הזה. לצפייה בכל האירועים כנסו ל־ ${baseUrl}`
  }
  let body = lines.join('\n').trim()
  if (onDateFlatEvents.length > MAX_EVENTS_IN_MESSAGE) body += MORE_EVENTS_LINE
  return body
}

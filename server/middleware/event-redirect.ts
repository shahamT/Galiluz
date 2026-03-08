import {
  getFirstFutureOccurrence,
  extractDocumentId,
  getTodayIsrael,
} from '~/server/utils/eventFirstOccurrence'
import { ROUTE_EVENTS_DAILY_VIEW } from '~/server/consts'

/**
 * Server middleware: when user visits /?event=xxx, redirect to /events/daily-view?date=X&event=Y
 * with the first occurrence date that is today or in the future (Israel time).
 */
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (path !== '/') return

  const method = getMethod(event)
  if (method !== 'GET') return

  const query = getQuery(event)
  const eventParam = query.event
  if (!eventParam || typeof eventParam !== 'string') {
    // Bare / with no ?event= — redirect immediately to today's daily view
    const todayStr = getTodayIsrael()
    return sendRedirect(event, `${ROUTE_EVENTS_DAILY_VIEW}?date=${todayStr}`, 302)
  }

  const docId = extractDocumentId(eventParam)
  if (!docId) return

  const result = await getFirstFutureOccurrence(docId)
  if (result) {
    const target = `${ROUTE_EVENTS_DAILY_VIEW}?date=${encodeURIComponent(result.date)}&event=${encodeURIComponent(result.eventId)}`
    return sendRedirect(event, target, 302)
  }

  const todayStr = getTodayIsrael()
  const target = `${ROUTE_EVENTS_DAILY_VIEW}?date=${todayStr}`
  return sendRedirect(event, target, 302)
})

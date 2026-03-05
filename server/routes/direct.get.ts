import {
  getFirstFutureOccurrence,
  extractDocumentId,
  getTodayIsrael,
} from '~/server/utils/eventFirstOccurrence'
import { ROUTE_EVENTS_DAILY_VIEW } from '~/server/consts'

/**
 * GET /direct?event=xxx
 * Redirects to /events/daily-view?date=YYYY-MM-DD&event=docId-index
 * with the first occurrence date that is today or in the future (Israel time).
 * Future: other params (e.g. class, portal) may redirect to other routes.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const eventParam = query.event
  if (!eventParam || typeof eventParam !== 'string') {
    return sendRedirect(event, ROUTE_EVENTS_DAILY_VIEW, 302)
  }

  const docId = extractDocumentId(eventParam)
  if (!docId) {
    return sendRedirect(event, ROUTE_EVENTS_DAILY_VIEW, 302)
  }

  const result = await getFirstFutureOccurrence(docId)
  if (result) {
    const target = `${ROUTE_EVENTS_DAILY_VIEW}?date=${encodeURIComponent(result.date)}&event=${encodeURIComponent(result.eventId)}`
    return sendRedirect(event, target, 302)
  }

  const todayStr = getTodayIsrael()
  return sendRedirect(event, `${ROUTE_EVENTS_DAILY_VIEW}?date=${todayStr}`, 302)
})

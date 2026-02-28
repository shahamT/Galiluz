import {
  getFirstFutureOccurrence,
  extractDocumentId,
  getTodayIsrael,
} from '~/server/utils/eventFirstOccurrence'

/**
 * GET /direct?event=xxx
 * Redirects to /daily-view?date=YYYY-MM-DD&event=docId-index
 * with the first occurrence date that is today or in the future (Israel time).
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const eventParam = query.event
  if (!eventParam || typeof eventParam !== 'string') {
    return sendRedirect(event, '/daily-view', 302)
  }

  const docId = extractDocumentId(eventParam)
  if (!docId) {
    return sendRedirect(event, '/daily-view', 302)
  }

  const result = await getFirstFutureOccurrence(docId)
  if (result) {
    const target = `/daily-view?date=${encodeURIComponent(result.date)}&event=${encodeURIComponent(result.eventId)}`
    return sendRedirect(event, target, 302)
  }

  const todayStr = getTodayIsrael()
  return sendRedirect(event, `/daily-view?date=${todayStr}`, 302)
})

import {
  extractDocumentId,
  getFirstFutureOccurrence,
} from '~/server/utils/eventFirstOccurrence'

/**
 * GET /api/events/[id]/first-occurrence
 * Returns the first occurrence date (today or future) for redirect logic.
 * Supports both document id (abc123) and flat occurrence id (abc123-0).
 */
export default defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, 'id')
  if (!idParam) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'id required' })
  }

  const docId = extractDocumentId(idParam)
  if (!docId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid id' })
  }

  const result = await getFirstFutureOccurrence(docId)
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'event not found' })
  }

  return result
})

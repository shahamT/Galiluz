import { getMongoConnection, getDbConfig } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'
import { getIsraelDayUtcRange } from '~/server/utils/israelDateRange'
import { getDateInIsraelFromIso } from '~/utils/israelDate'

const BY_PUBLISHER_LIMIT = 100

/**
 * GET /api/events/by-publisher?waId=...
 * Returns active events for the given publisher (waId) that have at least one occurrence today or in the future (Israel).
 * Sorted by earliest occurrence. Used by wa-bot for update/delete event selection.
 */
export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const waId = getQuery(event).waId
  if (!waId || typeof waId !== 'string' || !waId.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'waId is required',
    })
  }

  const todayIsrael = getDateInIsraelFromIso(new Date().toISOString())
  if (!todayIsrael) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Could not get today date',
    })
  }
  const todayRange = getIsraelDayUtcRange(todayIsrael)
  if (!todayRange) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Could not get today range',
    })
  }
  const todayStart = todayRange.startUTC
  const todayStartISO = todayStart.toISOString()

  const { uri, dbName, collections } = getDbConfig()

  if (!uri || !dbName) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
    })
  }

  const query = {
    'rawEvent.publisher.waId': waId.trim(),
    isActive: true,
    event: { $ne: null },
    $or: [
      { 'event.occurrences.startTime': { $gte: todayStart } },
      { 'event.occurrences.startTime': { $gte: todayStartISO } },
    ],
  }

  try {
    const { db } = await getMongoConnection()
    const collection = db.collection(collections.eventsWaBot || collections.events)
    const documents = await collection.find(query).limit(BY_PUBLISHER_LIMIT).toArray()

    const events = documents.map((doc) => {
      const ev = doc.event as Record<string, unknown> | null | undefined
      const occurrences = Array.isArray(ev?.occurrences) ? ev.occurrences : []
      const title = ev && typeof ev.Title === 'string' ? ev.Title : ''
      const id = doc._id?.toString() ?? String(doc._id)
      const minStart =
        occurrences.length > 0
          ? occurrences
              .map((occ: { startTime?: string }) => occ?.startTime)
              .filter(Boolean)
              .sort()[0]
          : null
      return { id, title, occurrences, _minStart: minStart }
    })

    events.sort((a, b) => {
      const sa = a._minStart ?? ''
      const sb = b._minStart ?? ''
      return String(sa).localeCompare(String(sb))
    })

    return {
      events: events.map(({ id, title, occurrences }) => ({ id, title, occurrences })),
    }
  } catch (err) {
    console.error(
      '[EventsAPI] by-publisher error:',
      err instanceof Error ? err.message : String(err),
    )
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    })
  }
})

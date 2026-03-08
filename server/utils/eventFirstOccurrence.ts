import { ObjectId } from 'mongodb'
import { getMongoConnection, getDbConfig } from '~/server/utils/mongodb'
import { getDateInIsraelFromIso } from '~/utils/israelDate'

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/

/**
 * Extracts the document ID from event param (supports both "docId" and "docId-0" flat format).
 */
export function extractDocumentId(param: string): string | null {
  if (!param || typeof param !== 'string') return null
  const trimmed = param.trim()
  if (!trimmed) return null
  const parts = trimmed.split('-')
  return parts[0] || trimmed
}

/**
 * Returns today's date in Israel (Asia/Jerusalem) as YYYY-MM-DD.
 */
export function getTodayIsrael(): string {
  const now = new Date()
  const d = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }))
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Extracts YYYY-MM-DD from an occurrence (date field or derived from startTime).
 */
function getOccurrenceDate(occ: { date?: string; startTime?: string }): string | null {
  if (occ?.date && YYYY_MM_DD.test(String(occ.date).trim().slice(0, 10))) {
    return String(occ.date).trim().slice(0, 10)
  }
  if (occ?.startTime) {
    return getDateInIsraelFromIso(occ.startTime)
  }
  return null
}

export interface FirstOccurrenceResult {
  date: string
  eventId: string
}

/**
 * Fetches event from MongoDB and returns the first occurrence that is today or in the future (Israel time).
 * @param docId - Document ID (without occurrence index)
 * @returns { date, eventId } or null if event not found or no future occurrences
 */
export async function getFirstFutureOccurrence(
  docId: string
): Promise<FirstOccurrenceResult | null> {
  if (!docId || typeof docId !== 'string') return null

  let objectId: ObjectId
  try {
    objectId = new ObjectId(docId)
  } catch {
    return null
  }

  const { uri, dbName, collections } = getDbConfig()

  if (!uri || !dbName) {
    return null
  }

  const { db } = await getMongoConnection()
  const collection = db.collection(collections.events)
  const doc = await collection.findOne({ _id: objectId })
  if (!doc || doc.isActive === false) {
    return null
  }

  const backendEvent = doc.event
  if (!backendEvent || !Array.isArray(backendEvent.occurrences)) {
    return null
  }

  const today = getTodayIsrael()
  const occurrences = backendEvent.occurrences as Array<{ date?: string; startTime?: string }>

  for (let i = 0; i < occurrences.length; i++) {
    const dateStr = getOccurrenceDate(occurrences[i])
    if (dateStr && dateStr >= today) {
      return {
        date: dateStr,
        eventId: `${docId}-${i}`,
      }
    }
  }

  return null
}

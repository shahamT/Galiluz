import { getDateInIsraelFromIso } from '~/utils/israelDate'

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/

/**
 * Transforms backend event document to frontend format.
 * - Title → title, location.City → location.city, _id → id (string)
 * - occurrence.date preserved when present; otherwise derived from startTime (Israel)
 */
export function transformEventForFrontend(doc: any): Record<string, unknown> | null {
  const backendEvent = doc.event
  if (!backendEvent) return null

  const eventId = doc._id?.toString() || String(doc._id)
  const dateCreated = doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt)

  const rawOccurrences = Array.isArray(backendEvent.occurrences) ? backendEvent.occurrences : []
  const occurrences = rawOccurrences.map((occ: any) => {
    const date =
      occ?.date && YYYY_MM_DD.test(String(occ.date).trim().slice(0, 10))
        ? String(occ.date).trim().slice(0, 10)
        : (getDateInIsraelFromIso(occ?.startTime) ?? undefined)
    return { ...occ, ...(date ? { date } : {}) }
  })

  if (occurrences.length > 0 && !occurrences[0].startTime) {
    console.warn('[EventsAPI] Occurrence missing startTime:', occurrences[0])
  }

  return {
    id: eventId,
    title: backendEvent.Title || '',
    shortDescription: backendEvent.shortDescription || '',
    fullDescription: backendEvent.fullDescription || '',
    categories: backendEvent.categories || [],
    mainCategory: backendEvent.mainCategory || '',
    price: backendEvent.price ?? null,
    media: backendEvent.media || [],
    urls: backendEvent.urls || [],
    location: {
      city: backendEvent.location?.City || '',
      locationName: backendEvent.location?.locationName || undefined,
      addressLine1: backendEvent.location?.addressLine1 || undefined,
      addressLine2: backendEvent.location?.addressLine2 || undefined,
      locationDetails: backendEvent.location?.locationDetails || undefined,
      wazeNavLink: backendEvent.location?.wazeNavLink || undefined,
      gmapsNavLink: backendEvent.location?.gmapsNavLink || undefined,
    },
    occurrences,
    isActive: doc.isActive !== false,
    dateCreated,
    publisherPhone: backendEvent.publisherPhone || undefined,
    publisherName: backendEvent.publisherName || undefined,
  }
}

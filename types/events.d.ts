/**
 * Type definitions for Galiluz events and categories
 * These types document the structure of data used throughout the application
 * and prepare for future TypeScript migration
 */

/**
 * Raw event payload from wa-bot (publisher add-event flow).
 * Keys mirror event fields with raw prefix; formatted event is built from these.
 */
export interface PublisherRawEvent {
  rawTitle?: string
  rawOccurrences?: string
  rawLocationName?: string
  rawCity?: string
  rawAddressLine1?: string
  rawAddressLine2?: string
  rawLocationDetails?: string
  rawNavLinks?: string
  rawPrice?: string
  rawFullDescription?: string
  rawUrls?: string
  rawMainCategory?: string
  rawCategories?: string[]
  rawMedia?: unknown[]
  publisher?: { phone?: string; name?: string; waId?: string }
}

/**
 * Event location details
 */
export interface EventLocation {
  city?: string
  /** Venue or place name (from rawLocationName) */
  locationName?: string
  addressLine1?: string
  addressLine2?: string
  locationDetails?: string
  wazeNavLink?: string
  gmapsNavLink?: string
  coordinates?: {
    lat: number
    lng: number
  }
}

/**
 * Event occurrence - a specific instance of an event
 */
export interface Occurrence {
  /** Calendar date (Israel) YYYY-MM-DD. When present, use for date matching; otherwise derive from startTime. */
  date?: string
  startTime: string // ISO 8601 date-time string (UTC)
  endTime?: string // ISO 8601 date-time string
  hasTime: boolean // If false, it's an all-day event
}

/**
 * Main event entity (API response shape: one per document with occurrences array)
 */
export interface Event {
  id: string
  title: string
  shortDescription?: string
  fullDescription?: string
  description?: string
  price?: number | null
  location?: EventLocation
  categories: string[] // Array of category IDs
  mainCategory: string // Primary category ID
  occurrences: Occurrence[]
  isActive: boolean
  createdAt?: string
  updatedAt?: string
  urls?: Array<{ Title: string; Url: string }> // Array of URL objects with Title and Url
  media?: any[] // Media attachments (images, videos)
  publisherPhone?: string // WhatsApp contact number
  publisherName?: string // Sender display name (push name) from WhatsApp
}

/**
 * Flattened event: one per occurrence, with occurrence fields at top level.
 * This is the shape used in the app after flattenEventsByOccurrence(); id is unique per occurrence (e.g. documentId-0).
 */
export type FlatEvent = Omit<Event, 'occurrences'> & Occurrence & { sourceEventId?: string }

/**
 * Category entity for event categorization
 */
export interface Category {
  id: string
  label: string
  color: string // Hex color code
}

/**
 * Event and occurrence pair used in filtered results
 */
export interface EventOccurrencePair {
  event: Event
  occurrence: Occurrence
}

/**
 * Transformed event card data for display
 */
export interface EventCard {
  id: string
  eventId: string
  mainCategory: string
  timeText: string
  title: string
  desc: string
  price: string
  occurrence: Occurrence
  event: Event
}

/**
 * Calendar date representation
 */
export interface CalendarDate {
  year: number
  month: number // 1-12 (1-indexed)
}

/**
 * Day cell data for monthly calendar grid
 */
export interface DayCell {
  dayNumber: number
  dateString: string // YYYY-MM-DD format
  isOutsideMonth: boolean
  eventsCount: number
  events: FlatEvent[]
}

/** Verification-first pipeline: source of an evidence quote */
export type EvidenceSource = 'message_text' | 'ocr_text' | 'url'

/** Single evidence candidate for a critical field (date, time, location, price) */
export interface EvidenceCandidate {
  quote: string
  source: EvidenceSource
  messageTextStartIdx?: number
  messageTextEndIdx?: number
  ocrBlockId?: string
  ocrLineId?: string
  fieldSubtype?: string
}

/** Evidence candidates per critical field from Evidence Locator (Pass A) */
export interface EvidenceCandidates {
  date: EvidenceCandidate[]
  timeOfDay: EvidenceCandidate[]
  location: EvidenceCandidate[]
  price: EvidenceCandidate[]
}

/** OCR block/line from provider (e.g. Google Vision); bbox optional */
export interface OcrBlock {
  id: string
  text: string
  confidence: number
  bbox?: [number, number, number, number]
}

export interface OcrLine {
  id: string
  text: string
  confidence: number
  blockId?: string
}

/** Full OCR result for an image */
export interface OcrData {
  fullText: string
  blocks?: OcrBlock[]
  lines?: OcrLine[]
}

/** Canonical source for pipeline: message text, URLs, timestamp, optional OCR */
export interface EventSourceDocument {
  messageTextRaw: string
  messageTextSanitized: string
  messageHtml: string
  extractedUrls: string[]
  messageTimestamp: number | null
  cloudinaryUrl?: string | null
  ocrText?: string | null
  ocrData?: OcrData | null
}

/** Per-field verification audit for debugging and review */
export interface VerificationReport {
  date?: {
    candidates: EvidenceCandidate[]
    chosen: string | null
    reasonChosen: string
    rejected?: string[]
  }
  timeOfDay?: {
    candidates: EvidenceCandidate[]
    chosen: string | null
    reasonChosen: string
    rejected?: string[]
  }
  location?: {
    candidates: EvidenceCandidate[]
    chosen: Record<string, unknown> | null
    reasonChosen: string
    rejected?: string[]
  }
  price?: {
    candidates: EvidenceCandidate[]
    chosen: number | null
    reasonChosen: string
    rejected?: string[]
  }
  needsReview?: boolean
}

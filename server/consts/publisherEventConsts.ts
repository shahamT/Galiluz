/**
 * Constants for publisher event formatting (wa-bot flow).
 * Aligned with wa-listener where applicable for consistent behavior.
 */

/** Phrases that indicate free entry. Price is 0 when raw contains one of these and no positive amount. */
export const FREE_INDICATING_PHRASES = [
  'חינם',
  'בחינם',
  'free',
  'כניסה חופשית',
  'ללא תשלום',
  'אין תשלום',
  'ללא עלות',
  'אין עלות',
  'חופשי',
  'גרטיס',
  'gratis',
  'no charge',
  'ללא דמי כניסה',
  'אין דמי כניסה',
] as const

/** Fallback category when AI returns no valid category. */
export const FALLBACK_CATEGORY_ID = 'community_meetup'

/** Map common AI mistakes (wrong IDs) to correct category IDs. Applied before validation. */
export const CATEGORY_ID_CORRECTIONS: Record<string, string> = {
  performance: 'show',
  concert: 'show',
  dance: 'party',
}

/** Max categories per event (main + additional). Enforced in PATCH and extra-categories flow. */
export const PUBLISHER_EVENT_MAX_CATEGORIES = 4

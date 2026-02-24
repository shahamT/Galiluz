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

/** Max length for a single string field in the raw event when building the OpenAI prompt. */
export const PROMPT_FIELD_MAX_LENGTH = 4000

/** Max total user content chars (existing cap in eventFormatOpenAI). */
export const MAX_USER_CONTENT_CHARS = 16_000

/** Leading-line pattern that may indicate prompt override. Stripped only at start of string. */
export const LEADING_OVERRIDE_PATTERN = /^\s*(system\s*:|\s*ignore\s+(all\s+)?(previous|above|prior)\s+instructions?|\s*disregard\s+(all\s+)?(previous|above)\s*|\s*you\s+are\s+now\s+)/im

/** Fallback category when AI returns no valid category. */
export const FALLBACK_CATEGORY_ID = 'community_meetup'

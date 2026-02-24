/**
 * Sanitize raw event string fields before sending to OpenAI.
 * Reduces token burst and prompt-injection risk (aligned with wa-listener sanitizeMessageForPrompt).
 */

import { PROMPT_FIELD_MAX_LENGTH, LEADING_OVERRIDE_PATTERN } from '~/server/consts/publisherEventConsts'

/**
 * Truncate and strip leading instruction-override attempts from a string.
 * Does not alter normal Hebrew or event content.
 */
export function sanitizeStringForPrompt(value: string | undefined): string {
  if (value == null || typeof value !== 'string') return ''
  let s = value.trim()
  const firstMatch = s.match(LEADING_OVERRIDE_PATTERN)
  if (firstMatch) {
    const end = s.indexOf('\n', firstMatch.index)
    s = (end === -1 ? s.slice(firstMatch.index + firstMatch[0].length) : s.slice(end + 1)).trim()
  }
  if (s.length > PROMPT_FIELD_MAX_LENGTH) {
    s = s.slice(0, PROMPT_FIELD_MAX_LENGTH)
  }
  return s
}

/**
 * Sanitize all string fields in a raw-event-like object that are sent in the prompt.
 * Returns a new object; does not mutate. Only top-level string fields are sanitized.
 */
export function sanitizeRawEventForPrompt(raw: Record<string, unknown>): Record<string, unknown> {
  const out = { ...raw }
  const stringKeys = [
    'rawTitle',
    'rawFullDescription',
    'rawOccurrences',
    'rawCity',
    'rawLocationName',
    'rawAddressLine1',
    'rawAddressLine2',
    'rawLocationDetails',
    'rawNavLinks',
    'rawPrice',
    'rawUrls',
    'rawMainCategory',
  ] as const
  for (const key of stringKeys) {
    if (typeof out[key] === 'string') {
      out[key] = sanitizeStringForPrompt(out[key] as string)
    }
  }
  return out
}

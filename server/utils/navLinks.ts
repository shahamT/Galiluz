/**
 * Extract Waze and Google Maps URLs from raw strings (e.g. "Waze: https://...").
 * Same patterns as apps/wa-listener/src/parsers/locationVerifier.js.
 */
const WAZE_URL_PATTERN = /https?:\/\/(?:www\.)?(?:waze\.com|ul\.waze\.com)\/[^\s]+/i
const GMAPS_URL_PATTERN = /https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl)[^\s]*/i
const ANY_URL_PATTERN = /https?:\/\/[^\s]+/g

function extractFirstUrlMatching(str: string | undefined, pattern: RegExp): string | null {
  if (!str || typeof str !== 'string') return null
  const matches = str.match(ANY_URL_PATTERN)
  if (!matches) return null
  for (const u of matches) {
    if (pattern.test(u)) return u
  }
  return null
}

/**
 * From raw nav link text (one or two strings; may contain both Waze and Google Maps URLs),
 * return the first Waze URL and the first Google Maps URL found in the combined text.
 */
export function extractNavLinksFromRaw(
  wazeRaw: string | undefined,
  gmapsRaw: string | undefined,
): { wazeNavLink: string | null; gmapsNavLink: string | null } {
  const combined = [wazeRaw, gmapsRaw].filter((s): s is string => typeof s === 'string' && s.trim().length > 0).join(' ')
  return {
    wazeNavLink: extractFirstUrlMatching(combined || undefined, WAZE_URL_PATTERN),
    gmapsNavLink: extractFirstUrlMatching(combined || undefined, GMAPS_URL_PATTERN),
  }
}

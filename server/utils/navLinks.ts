/**
 * Extract Waze and Google Maps URLs from raw strings (e.g. "Waze: https://...").
 * Same patterns as apps/wa-listener/src/parsers/locationVerifier.js.
 */
const WAZE_URL_PATTERN = /https?:\/\/(?:www\.)?(?:waze\.com|ul\.waze\.com)\/[^\s]+/i
const GMAPS_URL_PATTERN = /https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.google|goo\.gl\/maps)[^\s]*/i
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
 * From raw wazeNavLink/gmapsNavLink strings (may contain label + URL), return only the URL per type.
 */
export function extractNavLinksFromRaw(
  wazeRaw: string | undefined,
  gmapsRaw: string | undefined,
): { wazeNavLink: string | null; gmapsNavLink: string | null } {
  return {
    wazeNavLink: extractFirstUrlMatching(wazeRaw, WAZE_URL_PATTERN),
    gmapsNavLink: extractFirstUrlMatching(gmapsRaw, GMAPS_URL_PATTERN),
  }
}

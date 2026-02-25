const WAZE_URL_PATTERN = /https?:\/\/(?:www\.)?(?:waze\.com|ul\.waze\.com)\/[^\s]+/i
const GMAPS_URL_PATTERN = /https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl)[^\s]*/i
const ANY_URL_PATTERN = /https?:\/\/[^\s]+/g

function extractFirstUrlMatching(str, pattern) {
  if (!str || typeof str !== 'string') return null
  const matches = str.match(ANY_URL_PATTERN)
  if (!matches) return null
  for (const u of matches) {
    if (pattern.test(u)) return u
  }
  return null
}

export function extractNavLinksFromRaw(wazeRaw, gmapsRaw) {
  const combined = [wazeRaw, gmapsRaw].filter((s) => typeof s === 'string' && s.trim().length > 0).join(' ')
  return {
    wazeNavLink: extractFirstUrlMatching(combined || undefined, WAZE_URL_PATTERN),
    gmapsNavLink: extractFirstUrlMatching(combined || undefined, GMAPS_URL_PATTERN),
  }
}

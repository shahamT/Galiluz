/**
 * Verify location from evidence quotes and optional map URLs.
 * If Waze/Google Maps link exists, reverse-geocode (stub: can be wired to provider).
 * Else normalize city from quotes. Output includes verified, evidenceQuote, evidenceSource per field.
 */

const WAZE_URL_PATTERN = /https?:\/\/(?:www\.)?(?:waze\.com|ul\.waze\.com)\/[^\s]+/i
const GMAPS_URL_PATTERN = /https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl)[^\s]*/i

/**
 * Extract Waze and Google Maps URLs from a list of URLs.
 * @param {string[]} extractedUrls
 * @returns {{ wazeNavLink: string | null, gmapsNavLink: string | null }}
 */
export function extractMapLinks(extractedUrls) {
  const list = Array.isArray(extractedUrls) ? extractedUrls : []
  let wazeNavLink = null
  let gmapsNavLink = null
  for (const u of list) {
    if (WAZE_URL_PATTERN.test(u)) wazeNavLink = u
    if (GMAPS_URL_PATTERN.test(u)) gmapsNavLink = u
  }
  return { wazeNavLink, gmapsNavLink }
}

/**
 * Normalize city name to standard Hebrew (e.g. ת"א -> תל אביב). Minimal mapping.
 * @param {string} quote
 * @returns {string}
 */
function normalizeCityName(quote) {
  if (!quote || typeof quote !== 'string') return ''
  const s = quote.trim()
  const map = {
    "ת\"א": 'תל אביב',
    'תל אביב': 'תל אביב',
    'חיפה': 'חיפה',
    'ירושלים': 'ירושלים',
    'באר שבע': 'באר שבע',
    'הרצליה': 'הרצליה',
    'נתניה': 'נתניה',
    'רמת גן': 'רמת גן',
    'גבעתיים': 'גבעתיים',
    'ראשון לציון': 'ראשון לציון',
    'פתח תקווה': 'פתח תקווה',
    'אשדוד': 'אשדוד',
    'נהריה': 'נהריה',
    'עכו': 'עכו',
    'טבריה': 'טבריה',
    'אילת': 'אילת',
  }
  for (const [key, value] of Object.entries(map)) {
    if (s.includes(key) || key.includes(s)) return value
  }
  return s
}

/**
 * Verify location from evidence candidates and extracted URLs.
 * Does not call external geocoding by default; sets links from URLs and city from first location quote.
 *
 * @param {Array<{ quote: string, source: string }>} locationCandidates
 * @param {string[]} extractedUrls
 * @returns {{
 *   City: string,
 *   CityEvidence: string | null,
 *   addressLine1: string | null,
 *   addressLine2: string | null,
 *   locationDetails: string | null,
 *   wazeNavLink: string | null,
 *   gmapsNavLink: string | null,
 *   verified: boolean,
 *   evidenceQuote: string | null,
 *   evidenceSource: string | null
 * }}
 */
export function verifyLocation(locationCandidates, extractedUrls) {
  const { wazeNavLink, gmapsNavLink } = extractMapLinks(extractedUrls)
  const list = Array.isArray(locationCandidates) ? locationCandidates : []
  let City = ''
  let CityEvidence = null
  let evidenceQuote = null
  let evidenceSource = null

  if (list.length > 0 && list[0].quote) {
    const first = list[0]
    const q = first.quote.trim()
    City = normalizeCityName(q)
    CityEvidence = q
    evidenceQuote = q
    evidenceSource = first.source || 'message_text'
  }

  const verified = !!(City.length > 0 || wazeNavLink || gmapsNavLink)
  return {
    City,
    CityEvidence,
    addressLine1: null,
    addressLine2: null,
    locationDetails: null,
    wazeNavLink,
    gmapsNavLink,
    verified,
    evidenceQuote,
    evidenceSource,
  }
}

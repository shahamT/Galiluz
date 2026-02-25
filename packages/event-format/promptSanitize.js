const PROMPT_FIELD_MAX_LENGTH = 4000
const LEADING_OVERRIDE_PATTERN = /^\s*(system\s*:|\s*ignore\s+(all\s+)?(previous|above|prior)\s+instructions?|\s*disregard\s+(all\s+)?(previous|above)\s*|\s*you\s+are\s+now\s+)/im

export function sanitizeStringForPrompt(value) {
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

const STRING_KEYS = [
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
]

export function sanitizeRawEventForPrompt(raw) {
  const out = { ...raw }
  for (const key of STRING_KEYS) {
    if (typeof out[key] === 'string') {
      out[key] = sanitizeStringForPrompt(out[key])
    }
  }
  return out
}

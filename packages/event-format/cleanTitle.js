/**
 * Deterministic cleanup for an AI-extracted event title (Hebrew-aware, conservative).
 *
 * The model is told to produce a real event NAME, but it often keeps trailing "when" context
 * ("פסטיבל היין של ראש פינה בסופש הקרוב") or wraps the name in markdown/emoji ("💃אקסטאטיק ראש פינה🕺",
 * "*מסיבה!*"). This strips ONLY unambiguous decoration and trailing date/time qualifiers — never
 * content. Ambiguous day words (שבת/שישי/יום) are left in place so proper names like "קבלת שבת" or
 * "מסיבת יום העצמאות" are untouched; the prompt + eval handle the judgement cases. Pure + testable.
 */

// Trailing time-qualifier words that are (almost) never part of an event's name.
const SAFE_WHEN = new Set(['בסופש', 'סופש', 'השבוע', 'מחר', 'מחרתיים', 'הערב', 'הלילה'])
// Day words — only peeled as the single token before a "הקרוב/ה" (e.g. "שישי הקרוב"), never alone.
const DAY_WORDS = new Set(['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת', 'יום'])
const NEAR = new Set(['הקרוב', 'הקרובה', 'הקרוב!', 'הקרובה!'])

const TIME_RE = /^\d{1,2}:\d{2}(?:\s*[-–—]\s*\d{1,2}:\d{2})?$/
const DATE_RE = /^\d{1,2}[.\/]\d{1,2}(?:[.\/]\d{2,4})?$/

const dropPrep = (w) => (w.length > 1 && 'בלמ'.includes(w[0]) ? w.slice(1) : w)
// Membership test that also tolerates an attached preposition (ב/ל/מ), e.g. "בסופש" → "סופש".
// The raw token is checked first so a word that *starts* with one of those letters as part of the
// word itself ("מחר") is still matched directly.
const inSet = (set, w) => set.has(w) || set.has(dropPrep(w))

/** Strip leading/trailing whitespace, markdown, quotes, emoji and decorative punctuation. */
function stripEnds(s) {
  let prev
  do {
    prev = s
    s = s.trim()
    // leading/trailing markdown/quotes/decorative separators and punctuation
    s = s.replace(/^[\s*_"'“”„׳״|·•–—\-!?.,]+/u, '')
    s = s.replace(/[\s*_"'“”„׳״|·•–—\-!?.,]+$/u, '')
    // leading/trailing emoji (+ ZWJ / variation selectors)
    s = s.replace(/^(?:[\p{Extended_Pictographic}️‍]\s*)+/u, '')
    s = s.replace(/(?:\s*[\p{Extended_Pictographic}️‍])+$/u, '')
  } while (s !== prev)
  return s
}

/** Remove trailing date/time tokens and "when" qualifiers from the end of the title. */
function stripTrailingWhen(s) {
  const tokens = s.split(/\s+/).filter(Boolean)
  let triggered = false
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1]
    if (TIME_RE.test(last) || DATE_RE.test(last)) { tokens.pop(); triggered = true; continue }
    if (NEAR.has(last)) {
      tokens.pop()
      // a single day/when word right before "הקרוב" is part of the qualifier ("שישי הקרוב")
      const before = tokens[tokens.length - 1]
      if (before && (inSet(DAY_WORDS, before) || inSet(SAFE_WHEN, before))) tokens.pop()
      triggered = true
      continue
    }
    if (inSet(SAFE_WHEN, last)) { tokens.pop(); triggered = true; continue }
    break
  }
  return triggered ? tokens.join(' ') : s
}

/**
 * Clean an extracted event title. Returns the cleaned string, or the trimmed original when cleaning
 * would empty it (so the caller never ends up with a blank title).
 * @param {string|null|undefined} title
 * @returns {string}
 */
export function cleanTitle(title) {
  const original = (title ?? '').toString().trim().replace(/\s+/g, ' ')
  if (!original) return ''
  // Emoji are never part of an event NAME — remove them anywhere (not just the edges).
  let s = original.replace(/[\p{Extended_Pictographic}️‍]/gu, ' ').replace(/\s+/g, ' ').trim()
  s = stripEnds(s)
  s = stripTrailingWhen(s)
  s = stripEnds(s)
  return s || original
}

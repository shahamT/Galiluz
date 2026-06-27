/**
 * Strip a redundant city name out of an AI-extracted place/venue name (Hebrew-aware).
 *
 * The AI extractor stores city separately, but often repeats it inside locationName/addressLine1
 * (e.g. "פאב הפילוסוף בגושרים" + city "הגושרים" → ugly address "פאב הפילוסוף בגושרים, הגושרים").
 * This removes the city from the place name — but only when the city is clearly *appended*, so a
 * proper name where the city is integral ("אוניברסיטת תל חי", "יקב הר אודם") is never clipped.
 *
 * CONSERVATIVE policy — the city run (at the end, or start) is stripped only when it is "detached":
 *  - the first city word carries a preposition particle (ב/כ/ל/מ/ש, optionally ו): "...בגושרים", or
 *  - it is separated by a comma or hyphen: "מאפיית בלה-צפת", "פאב הפטריה - קיבוץ דן", or
 *  - it is preceded by a settlement qualifier (קיבוץ/מושב/…): "בית רזי קיבוץ גונן", or
 *  - the place name equals the city exactly (pure redundancy) → emptied.
 * A plain "<venue> <city>" with no such signal is left UNCHANGED (e.g. "מתנ״ס ראש פינה").
 *
 * Matching ignores the definite article "ה" on either side ("גושרים" == "הגושרים") and an attached
 * preposition on the place word, but never mutates the city's own name (city "מגדל" matches place
 * "מגדל"/"במגדל" and never the lookalike "הגדול"). Pure + dependency-free → unit-testable.
 */

const PARTICLES = 'בכלמש' // single-letter prepositions that can attach to a noun
const QUALIFIERS = new Set(['קיבוץ', 'מושב', 'מושבה', 'היישוב', 'הישוב', 'יישוב', 'ישוב'])
const SEP_TOKENS = new Set([',', '-', '–', '—']) // comma, hyphen, en/em dash

function stripHe(w) {
  return w.length > 1 && w[0] === 'ה' ? w.slice(1) : w
}
function dropVav(w) {
  return w.length > 1 && w[0] === 'ו' ? w.slice(1) : w
}
function dropPrep(w) {
  return w.length > 1 && PARTICLES.includes(w[0]) ? w.slice(1) : w
}
/** Candidate forms of a place word after removing an optional leading preposition (ו + בכלמש). */
function prepForms(w) {
  return [...new Set([w, dropVav(w), dropPrep(w), dropPrep(dropVav(w))])]
}
function core(w) {
  return stripHe(w).toLowerCase()
}
/** Does a place word equal a city word, ignoring the article and (when allowPrep) a preposition? */
function wordMatches(placeWord, cityWord, allowPrep) {
  const cityCore = core(cityWord)
  const cands = allowPrep ? prepForms(placeWord) : [placeWord]
  return cands.some((c) => core(c) === cityCore)
}
/** True only when the place word needed a preposition stripped to match (→ city is "detached"). */
function hasPreposition(placeWord, cityWord) {
  const cityCore = core(cityWord)
  if (core(placeWord) === cityCore) return false // matched plainly, no preposition
  return prepForms(placeWord).some((c) => core(c) === cityCore)
}
function isQualifier(word) {
  return prepForms(word).some((f) => QUALIFIERS.has(f))
}
function isSep(tok) {
  return SEP_TOKENS.has(tok)
}

function normalize(s) {
  return (s ?? '').toString().trim().replace(/\s+/g, ' ')
}
/** Split on whitespace, turning comma/hyphen/dash into their own separator tokens. */
function tokenize(s) {
  return s.replace(/[,–—-]/g, ' $& ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
}
/** Re-join kept tokens; separator tokens glue to their neighbours without surrounding spaces. */
function joinTokens(tokens) {
  let out = ''
  let glue = false
  for (const t of tokens) {
    if (isSep(t)) { out += t; glue = true; continue }
    if (out === '') out = t
    else if (glue) { out += t; glue = false }
    else out += ' ' + t
  }
  return out.trim()
}
/** Drop trailing separator tokens, then join. */
function remainderOf(tokens, endExclusive) {
  let end = endExclusive
  while (end > 0 && isSep(tokens[end - 1])) end--
  return joinTokens(tokens.slice(0, end))
}

/** Try matching the city words as a contiguous run at the END of the tokens. */
function trySuffix(tokens, cityWords) {
  let end = tokens.length
  while (end > 0 && isSep(tokens[end - 1])) end-- // ignore trailing separators ("פאב גושרים,")
  const k = cityWords.length
  const runStart = end - k
  if (runStart < 0) return null
  for (let i = 0; i < k; i++) {
    const tok = tokens[runStart + i]
    if (isSep(tok) || !wordMatches(tok, cityWords[i], i === 0)) return null
  }

  let detached = hasPreposition(tokens[runStart], cityWords[0])
  let cut = runStart

  // a separator immediately before the run detaches it
  let before = runStart - 1
  while (before >= 0 && isSep(tokens[before])) { detached = true; before-- }
  // a settlement qualifier immediately before the run is consumed too
  if (before >= 0 && isQualifier(tokens[before])) {
    detached = true
    cut = before
  }

  const whole = cut === 0
  if (!detached && !whole) return null
  return { stripped: remainderOf(tokens, cut) || null }
}

/** Try matching the city words as a contiguous run at the START of the tokens (detached only). */
function tryPrefix(tokens, cityWords) {
  let start = 0
  while (start < tokens.length && isSep(tokens[start])) start++ // ignore leading separators
  const k = cityWords.length
  if (start + k > tokens.length) return null
  for (let i = 0; i < k; i++) {
    const tok = tokens[start + i]
    if (isSep(tok) || !wordMatches(tok, cityWords[i], i === 0)) return null
  }
  const after = start + k
  const whole = after >= tokens.length
  const detached = hasPreposition(tokens[start], cityWords[0]) || (after < tokens.length && isSep(tokens[after]))
  if (!detached && !whole) return null
  // remainder = everything after the run, dropping leading separators
  let from = after
  while (from < tokens.length && isSep(tokens[from])) from++
  return { stripped: joinTokens(tokens.slice(from)) || null }
}

/**
 * Remove the city from a place/venue name when it is redundantly appended (see policy above).
 * @param {string|null|undefined} city
 * @param {string|null|undefined} name
 * @returns {string|null} the cleaned name, or null when nothing meaningful remains / name was empty.
 */
export function stripCityFromName(city, name) {
  const n = normalize(name)
  if (!n) return null
  const c = normalize(city)
  if (c.replace(/\s/g, '').length < 2) return n // no city, or a 1-char city → never strip

  const cityWords = c.split(' ').filter(Boolean)
  const tokens = tokenize(n)
  const acted = trySuffix(tokens, cityWords) || tryPrefix(tokens, cityWords)
  return acted ? acted.stripped : n
}

/**
 * Apply {@link stripCityFromName} to both locationName and addressLine1. Drop-in replacement for the
 * previous freeLanguageExtract helper of the same name/signature.
 * @returns {{ locationName: string|null, addressLine1: string|null }}
 */
export function stripCityFromLocationFields(city, locationName, addressLine1) {
  return {
    locationName: stripCityFromName(city, locationName),
    addressLine1: stripCityFromName(city, addressLine1),
  }
}

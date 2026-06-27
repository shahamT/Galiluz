/**
 * Deterministic safety net for an AI-generated event description (HTML).
 *
 * The prompt tells the model to move every link/phone into the `urls` field and keep them out of the
 * description, but it occasionally leaves a raw URL in the body (especially when reformatting into a
 * list). This guarantees no raw URL survives: it removes http(s)/www links and the label/markup that
 * only introduced them, then cleans up any now-empty <li>/<p> and dangling separators. Pure + testable.
 *
 * Phone numbers are intentionally NOT stripped here (a bare digit run is ambiguous — a year, an
 * address number, an age range) — those stay prompt + eval guarded.
 */

// A URL token: http(s)://… or a bare www.… up to the next whitespace or '<'.
const URL_RE = /(?:https?:\/\/|www\.)[^\s<]+/gi

/**
 * Remove raw URLs from an HTML description and tidy the result.
 * @param {string|null|undefined} html
 * @returns {string}
 */
export function stripLinksFromHtml(html) {
  let s = (html ?? '').toString()
  if (!s) return ''
  if (!URL_RE.test(s)) return s
  URL_RE.lastIndex = 0

  // Drop the URL itself.
  s = s.replace(URL_RE, '')
  // Remove a dangling connector that only introduced the (now-gone) URL, before a closing tag,
  // e.g. "להרשמה: </p>" → "להרשמה</p>". Only the connector, never the words.
  s = s.replace(/\s*[:\-–—|]+\s*(?=<\/(?:li|p)>)/g, '')
  // Collapse double spaces created by the removal.
  s = s.replace(/[ \t]{2,}/g, ' ')
  // Collapse repeated <br>, then drop <br> runs hugging a tag boundary.
  s = s.replace(/(?:<br\s*\/?>\s*){2,}/gi, '<br>')
  s = s.replace(/(<(?:p|li)>)(?:\s*<br\s*\/?>)+/gi, '$1').replace(/(?:<br\s*\/?>\s*)+(<\/(?:p|li)>)/gi, '$1')
  // Trim whitespace right after an opening tag / right before a closing tag ("<p>א </p>" → "<p>א</p>").
  s = s.replace(/(<(?:p|li|ul|ol)>)\s+/gi, '$1').replace(/\s+(<\/(?:p|li|ul|ol)>)/gi, '$1')
  // Drop list items / paragraphs that are now empty, then any empty list left behind.
  s = s.replace(/<li>(?:\s|<br\s*\/?>)*<\/li>/gi, '')
  s = s.replace(/<p>(?:\s|<br\s*\/?>)*<\/p>/gi, '')
  s = s.replace(/<(ul|ol)>\s*<\/\1>/gi, '')
  return s.trim()
}

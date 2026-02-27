/**
 * Avoid double asterisks: if content is already *x* (single bold span), return as-is; else wrap.
 */
function unwrapBold(txt) {
  if (!txt) return ''
  const m = txt.match(/^\*([^*]*)\*$/)
  return m ? txt : `*${txt}*`
}

function unwrapItalic(txt) {
  if (!txt) return ''
  const m = txt.match(/^_([^_]*)_$/)
  return m ? txt : `_${txt}_`
}

function unwrapStrike(txt) {
  if (!txt) return ''
  const m = txt.match(/^~([^~]*)~$/)
  return m ? txt : `~${txt}~`
}

/**
 * Convert HTML to WhatsApp message format (plain text with *bold*, _italic_, ~strikethrough~, ```code```).
 * Used when displaying fullDescription in event summary and suggested-edits confirmation (wa-bot).
 * No DOM dependency; regex/simple string handling only.
 */
export function htmlToWhatsAppMessage(html) {
  if (!html || typeof html !== 'string') return ''
  let s = html.trim()
  if (!s) return ''

  // Process list items with bullet prefix (before generic block replacement)
  s = s.replace(/<\s*li\s*>([\s\S]*?)<\s*\/\s*li\s*>/gi, (_, inner) => '\n• ' + htmlToWhatsAppMessage(inner).trim() + '\n')

  // Replace block elements with newlines (so we get line breaks)
  s = s.replace(/<\s*br\s*\/?>/gi, '\n')
  s = s.replace(/<\s*\/\s*p\s*>/gi, '\n')
  s = s.replace(/<\s*\/\s*div\s*>/gi, '\n')
  s = s.replace(/<\s*\/\s*li\s*>/gi, '\n')
  s = s.replace(/<\s*\/\s*blockquote\s*>/gi, '\n')
  s = s.replace(/<\s*\/\s*ul\s*>/gi, '\n')
  s = s.replace(/<\s*\/\s*ol\s*>/gi, '\n')
  s = s.replace(/<\s*p\s*>/gi, '\n')
  s = s.replace(/<\s*div[^>]*>/gi, '\n')
  s = s.replace(/<\s*li[^>]*>/gi, '\n')
  s = s.replace(/<\s*blockquote[^>]*>/gi, '\n')
  s = s.replace(/<\s*ul[^>]*>/gi, '\n')
  s = s.replace(/<\s*ol[^>]*>/gi, '\n')

  // Strong/bold: <strong>...</strong> or <b>...</b> -> *...*
  // Avoid double asterisks when inner already has * (e.g. <strong>*text*</strong> from bad AI/conversion)
  s = s.replace(/<\s*strong\s*>([\s\S]*?)<\s*\/\s*strong\s*>/gi, (_, inner) => unwrapBold(htmlToWhatsAppMessage(inner).trim()))
  s = s.replace(/<\s*b\s*>([\s\S]*?)<\s*\/\s*b\s*>/gi, (_, inner) => unwrapBold(htmlToWhatsAppMessage(inner).trim()))

  // Em/italic: <em>...</em> or <i>...</i> -> _..._
  s = s.replace(/<\s*em\s*>([\s\S]*?)<\s*\/\s*em\s*>/gi, (_, inner) => unwrapItalic(htmlToWhatsAppMessage(inner).trim()))
  s = s.replace(/<\s*i\s*>([\s\S]*?)<\s*\/\s*i\s*>/gi, (_, inner) => unwrapItalic(htmlToWhatsAppMessage(inner).trim()))

  // Strikethrough: <s>...</s> or <del>...</del> -> ~...~
  s = s.replace(/<\s*s\s*>([\s\S]*?)<\s*\/\s*s\s*>/gi, (_, inner) => unwrapStrike(htmlToWhatsAppMessage(inner).trim()))
  s = s.replace(/<\s*del\s*>([\s\S]*?)<\s*\/\s*del\s*>/gi, (_, inner) => unwrapStrike(htmlToWhatsAppMessage(inner).trim()))

  // Monospace: <code>...</code> -> ```...```
  s = s.replace(/<\s*code\s*>([\s\S]*?)<\s*\/\s*code\s*>/gi, (_, inner) => '```' + htmlToWhatsAppMessage(inner).trim() + '```')

  // Strip any remaining tags
  s = s.replace(/<[^>]+>/g, '')

  // Decode common entities
  s = s.replace(/&nbsp;/gi, ' ')
  s = s.replace(/&amp;/g, '&')
  s = s.replace(/&lt;/g, '<')
  s = s.replace(/&gt;/g, '>')
  s = s.replace(/&quot;/g, '"')

  // Normalize whitespace: collapse multiple newlines to max 2, trim each line
  const lines = s.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim())
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

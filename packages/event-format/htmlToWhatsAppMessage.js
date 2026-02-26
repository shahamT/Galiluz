/**
 * Convert HTML to WhatsApp message format (plain text with *bold* and _italic_).
 * Used when displaying fullDescription in suggested-edits confirmation (wa-bot edit flow).
 * No DOM dependency; regex/simple string handling only.
 */
export function htmlToWhatsAppMessage(html) {
  if (!html || typeof html !== 'string') return ''
  let s = html.trim()
  if (!s) return ''

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
  s = s.replace(/<\s*li\s*>/gi, '\n')
  s = s.replace(/<\s*blockquote[^>]*>/gi, '\n')
  s = s.replace(/<\s*ul[^>]*>/gi, '\n')
  s = s.replace(/<\s*ol[^>]*>/gi, '\n')

  // Strong/bold: <strong>...</strong> or <b>...</b> -> *...*
  s = s.replace(/<\s*strong\s*>([\s\S]*?)<\s*\/\s*strong\s*>/gi, (_, inner) => `*${htmlToWhatsAppMessage(inner).trim()}*`)
  s = s.replace(/<\s*b\s*>([\s\S]*?)<\s*\/\s*b\s*>/gi, (_, inner) => `*${htmlToWhatsAppMessage(inner).trim()}*`)

  // Em/italic: <em>...</em> or <i>...</i> -> _..._
  s = s.replace(/<\s*em\s*>([\s\S]*?)<\s*\/\s*em\s*>/gi, (_, inner) => `_${htmlToWhatsAppMessage(inner).trim()}_`)
  s = s.replace(/<\s*i\s*>([\s\S]*?)<\s*\/\s*i\s*>/gi, (_, inner) => `_${htmlToWhatsAppMessage(inner).trim()}_`)

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

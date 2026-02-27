import pkg from '@flasd/whatsapp-formatting'
const { format } = pkg

/**
 * Converts raw WhatsApp message text to HTML. Mirrors server/utils/whatsappFormatToHtml.
 */
export function convertMessageToHtml(plainText) {
  if (!plainText || typeof plainText !== 'string') return plainText || ''
  const lines = plainText.trim().split(/\r?\n/)
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('> ')) {
      const quoteLines = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(format(lines[i].slice(2).trim()))
        i++
      }
      blocks.push('<blockquote><p>' + quoteLines.join('</p><p>') + '</p></blockquote>')
      continue
    }
    if (/^[\*\-]\s/.test(line)) {
      const ulItems = []
      while (i < lines.length && /^[\*\-]\s/.test(lines[i])) {
        const content = lines[i].replace(/^[\*\-]\s/, '')
        ulItems.push('<li>' + format(content) + '</li>')
        i++
      }
      blocks.push('<ul>' + ulItems.join('') + '</ul>')
      continue
    }
    if (/^\d+\.\s/.test(line)) {
      const olItems = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const content = lines[i].replace(/^\d+\.\s/, '')
        olItems.push('<li>' + format(content) + '</li>')
        i++
      }
      blocks.push('<ol>' + olItems.join('') + '</ol>')
      continue
    }
    const paraLines = []
    while (
      i < lines.length &&
      lines[i] !== '' &&
      !lines[i].startsWith('> ') &&
      !/^[\*\-]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i])
    ) {
      paraLines.push(format(lines[i]))
      i++
    }
    if (paraLines.length > 0) {
      blocks.push('<p>' + paraLines.join('<br>') + '</p>')
    }
    let blankCount = 0
    while (i < lines.length && lines[i] === '') {
      blankCount++
      i++
    }
    for (let j = 1; j < blankCount; j++) blocks.push('<p><br></p>')
  }

  return blocks.join('')
}

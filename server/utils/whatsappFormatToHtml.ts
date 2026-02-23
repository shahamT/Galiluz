// @ts-expect-error no types for this package
import pkg from '@flasd/whatsapp-formatting'

const { format } = pkg as { format: (text: string) => string }

/**
 * Converts raw WhatsApp message text (with * _ ~ ` ``` > bullets etc.) to HTML.
 * Mirrors apps/wa-listener/src/utils/whatsappFormatToHtml.js for consistent fullDescription format.
 * @param plainText - Raw message text
 * @returns HTML string
 */
export function convertMessageToHtml(plainText: string): string {
  if (!plainText || typeof plainText !== 'string') return plainText || ''
  const lines = plainText.trim().split(/\r?\n/)
  const blocks: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(format(lines[i].slice(2).trim()))
        i++
      }
      blocks.push('<blockquote><p>' + quoteLines.join('</p><p>') + '</p></blockquote>')
      continue
    }
    if (/^[\*\-]\s/.test(line)) {
      const ulItems: string[] = []
      while (i < lines.length && /^[\*\-]\s/.test(lines[i])) {
        const content = lines[i].replace(/^[\*\-]\s/, '')
        ulItems.push('<li>' + format(content) + '</li>')
        i++
      }
      blocks.push('<ul>' + ulItems.join('') + '</ul>')
      continue
    }
    if (/^\d+\.\s/.test(line)) {
      const olItems: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const content = lines[i].replace(/^\d+\.\s/, '')
        olItems.push('<li>' + format(content) + '</li>')
        i++
      }
      blocks.push('<ol>' + olItems.join('') + '</ol>')
      continue
    }
    const paraLines: string[] = []
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
    while (i < lines.length && lines[i] === '') i++
  }

  return blocks.join('')
}

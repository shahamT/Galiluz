import { describe, it, expect, vi } from 'vitest'

// Stub the third-party inline formatter to identity so we test OUR block parser
// (paragraphs / lists / quotes / blank-line spacing), not the library's *bold* handling.
// Matches the source's `import pkg from '@flasd/whatsapp-formatting'; const { format } = pkg`.
vi.mock('@flasd/whatsapp-formatting', () => ({ default: { format: (s: string) => s } }))

import { convertMessageToHtml } from '~/server/utils/whatsappFormatToHtml'

describe('convertMessageToHtml', () => {
  it('wraps consecutive lines in a paragraph joined by <br>', () => {
    expect(convertMessageToHtml('hello\nworld')).toBe('<p>hello<br>world</p>')
  })

  it('splits paragraphs on a blank line', () => {
    expect(convertMessageToHtml('a\n\nb')).toBe('<p>a</p><p>b</p>')
  })

  it('emits a spacer paragraph for each extra blank line beyond the first', () => {
    expect(convertMessageToHtml('a\n\n\nb')).toBe('<p>a</p><p><br></p><p>b</p>')
  })

  it('renders unordered lists (* and -)', () => {
    expect(convertMessageToHtml('* one\n* two')).toBe('<ul><li>one</li><li>two</li></ul>')
    expect(convertMessageToHtml('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>')
  })

  it('renders ordered lists', () => {
    expect(convertMessageToHtml('1. one\n2. two')).toBe('<ol><li>one</li><li>two</li></ol>')
  })

  it('renders blockquotes (single and multi-line)', () => {
    expect(convertMessageToHtml('> quoted')).toBe('<blockquote><p>quoted</p></blockquote>')
    expect(convertMessageToHtml('> line one\n> line two')).toBe('<blockquote><p>line one</p><p>line two</p></blockquote>')
  })

  it('handles a mixed paragraph + list document', () => {
    expect(convertMessageToHtml('intro\n* a\n* b')).toBe('<p>intro</p><ul><li>a</li><li>b</li></ul>')
  })

  it('returns empty string for empty / non-string input', () => {
    expect(convertMessageToHtml('')).toBe('')
    expect(convertMessageToHtml(null as unknown as string)).toBe('')
  })
})

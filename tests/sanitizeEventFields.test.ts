import { describe, it, expect } from 'vitest'
import { safeUrl, stripHtml, sanitizeHtml, sanitizeEventFields } from '~/server/utils/sanitizeEventFields'

describe('safeUrl', () => {
  it('allows http/https URLs', () => {
    expect(safeUrl('https://example.com/x')).toBe('https://example.com/x')
    expect(safeUrl('http://example.com')).toBe('http://example.com')
  })

  it('blocks javascript:, data: and other schemes', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,<script>x</script>')).toBeNull()
    expect(safeUrl('vbscript:x')).toBeNull()
    expect(safeUrl('file:///etc/passwd')).toBeNull()
  })

  it('rejects non-strings and garbage', () => {
    expect(safeUrl(null)).toBeNull()
    expect(safeUrl(42)).toBeNull()
    expect(safeUrl('not a url')).toBeNull()
  })
})

describe('stripHtml / sanitizeHtml', () => {
  it('strips all tags from plain text fields', () => {
    expect(stripHtml('<img src=x onerror=alert(1)>hello')).toBe('hello')
  })

  it('removes scripts but keeps allowed structure', () => {
    const out = sanitizeHtml('<p>ok</p><script>evil()</script><strong onclick="x()">bold</strong>')
    expect(out).toContain('<p>ok</p>')
    expect(out).toContain('<strong>bold</strong>')
    expect(out).not.toContain('script')
    expect(out).not.toContain('onclick')
  })
})

describe('sanitizeEventFields', () => {
  it('sanitizes urls array in place, blocking dangerous schemes', () => {
    const body: Record<string, unknown> = {
      urls: [
        { type: 'link', Url: 'javascript:alert(1)', Title: '<b>x</b>' },
        { type: 'link', Url: 'https://ok.com', Title: 'fine' },
      ],
    }
    sanitizeEventFields(body)
    const urls = body.urls as Array<{ Url: string }>
    expect(urls[0].Url).toBe('')
    expect(urls[1].Url).toBe('https://ok.com')
  })
})

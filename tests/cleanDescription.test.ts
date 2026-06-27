import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS helper, no types
import { stripLinksFromHtml } from '~/packages/event-format/cleanDescription.js'

describe('stripLinksFromHtml — removes raw URLs from the description body', () => {
  it('removes an http(s) URL inside a paragraph, keeping the surrounding text', () => {
    expect(stripLinksFromHtml('<p>הרשמה בקישור https://example.com/abc נתראה</p>'))
      .toBe('<p>הרשמה בקישור נתראה</p>')
  })
  it('removes a bare www URL', () => {
    expect(stripLinksFromHtml('<p>פרטים www.galiluz.co.il/x</p>')).toBe('<p>פרטים</p>')
  })
  it('drops a list item that was only a URL', () => {
    expect(stripLinksFromHtml('<ul><li>בייס בועט</li><li>https://web.vibez.io/events/bassbusa3</li></ul>'))
      .toBe('<ul><li>בייס בועט</li></ul>')
  })
  it('removes an empty list entirely when its only item was a URL', () => {
    expect(stripLinksFromHtml('<p>הצטרפו</p><ul><li>https://maps.app.goo.gl/MQ8</li></ul>'))
      .toBe('<p>הצטרפו</p>')
  })
  it('strips a dangling connector left before the closing tag (label: <url>)', () => {
    expect(stripLinksFromHtml('<p>להרשמה: https://luma.com/x</p>')).toBe('<p>להרשמה</p>')
  })
  it('handles multiple URLs in one description', () => {
    expect(stripLinksFromHtml('<p>א https://a.com</p><p>ב https://b.com/y נתראה</p>'))
      .toBe('<p>א</p><p>ב נתראה</p>')
  })
})

describe('stripLinksFromHtml — no-op when there is nothing to strip', () => {
  it('returns clean HTML unchanged', () => {
    const html = '<p>🎉 <strong>מסיבה</strong></p><ul><li>מוזיקה</li><li>אוכל</li></ul>'
    expect(stripLinksFromHtml(html)).toBe(html)
  })
  it('does not touch phone numbers or plain numbers', () => {
    const html = '<p>לפרטים יהונתן 0509493878, החל מ-2026</p>'
    expect(stripLinksFromHtml(html)).toBe(html)
  })
  it('returns empty string for empty/missing input', () => {
    expect(stripLinksFromHtml('')).toBe('')
    expect(stripLinksFromHtml(null)).toBe('')
    expect(stripLinksFromHtml(undefined)).toBe('')
  })
})

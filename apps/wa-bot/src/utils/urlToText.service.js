/**
 * Fetch a URL and convert its HTML to plain text for AI extraction.
 * Used when user selects "הוספה באמצעות קישור" in the event add flow.
 */
import { convert } from 'html-to-text'

const FETCH_TIMEOUT_MS = 15_000
const MAX_PAGE_CONTENT_CHARS = 50_000
const USER_AGENT = 'Mozilla/5.0 (compatible; GaliluzBot/1.0)'

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/

/**
 * Extract the first http/https URL from user message.
 * @param {string} text - User message (may contain plain URL or "check this https://...")
 * @returns {string|null} - Extracted URL or null if none found
 */
export function extractUrlFromText(text) {
  if (typeof text !== 'string' || !text.trim()) return null
  const match = text.trim().match(URL_REGEX)
  if (!match) return null
  let url = match[0].replace(/[.,;:!?)]+$/, '')
  if (!url.startsWith('http://') && !url.startsWith('https://')) return null
  try {
    new URL(url)
    return url
  } catch {
    return null
  }
}

/**
 * Fetch URL and convert HTML to plain text, preserving structure for AI extraction.
 * Returns full page content (nav, footer, etc.) so the AI can extract event-relevant parts.
 * @param {string} url - Valid http/https URL
 * @returns {Promise<{ success: true, text: string, html: string } | { success: false, error: 'fetch_failed' | 'empty_content' }>}
 */
export async function fetchAndGetPageContent(url) {
  if (typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return { success: false, error: 'fetch_failed' }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      return { success: false, error: 'fetch_failed' }
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return { success: false, error: 'empty_content' }
    }

    const html = await res.text()
    if (!html || html.trim().length === 0) {
      return { success: false, error: 'empty_content' }
    }

    const htmlToConvert = html.length > 500_000 ? html.slice(0, 500_000) : html
    const text = convert(htmlToConvert, {
      wordwrap: false,
      baseElements: { selectors: ['body'], returnDomByDefault: true },
      selectors: [
        { selector: 'script', format: 'skip' },
        { selector: 'style', format: 'skip' },
        { selector: 'noscript', format: 'skip' },
      ],
    })

    const trimmed = (text || '').trim()
    if (!trimmed || trimmed.length < 50) {
      return { success: false, error: 'empty_content' }
    }

    const result = trimmed.length > MAX_PAGE_CONTENT_CHARS ? trimmed.slice(0, MAX_PAGE_CONTENT_CHARS) : trimmed
    return { success: true, text: result, html }
  } catch {
    clearTimeout(timeoutId)
    return { success: false, error: 'fetch_failed' }
  }
}

const EXCLUDE_IMAGE_PATTERNS = /logo|gdpr|cookie|favicon|icon|avatar/i
const MAX_EXTRACTED_IMAGES = 5

/**
 * Extract event-relevant image URLs from HTML.
 * Excludes logos, icons, cookie banners. Handles Next.js _next/image URLs.
 * @param {string} html - Raw HTML
 * @returns {string[]} - Up to MAX_EXTRACTED_IMAGES URLs
 */
export function extractImageUrlsFromHtml(html) {
  if (!html || typeof html !== 'string') return []
  const urls = new Set()

  const addIfValid = (url) => {
    if (!url || typeof url !== 'string') return
    const u = url.trim()
    if (!u.startsWith('http://') && !u.startsWith('https://')) return
    if (EXCLUDE_IMAGE_PATTERNS.test(u)) return
    try {
      new URL(u)
      urls.add(u)
    } catch {
      // ignore invalid URLs
    }
  }

  const directImgRegex = /https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>]*)?/gi
  const directMatches = html.match(directImgRegex) || []
  for (const m of directMatches) {
    addIfValid(m.replace(/&amp;/g, '&'))
  }

  const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  if (ogImageMatch) addIfValid(ogImageMatch[1].replace(/&amp;/g, '&'))

  const nextImageMatch = html.match(/\/_next\/image\?url=([^&\s"']+)/i)
  if (nextImageMatch) {
    try {
      const decoded = decodeURIComponent(nextImageMatch[1])
      addIfValid(decoded)
    } catch {
      // ignore
    }
  }

  const imgSrcRegex = /<img[^>]+src=["']([^"']+)["']/gi
  let imgMatch
  while ((imgMatch = imgSrcRegex.exec(html)) && urls.size < MAX_EXTRACTED_IMAGES) {
    const src = imgMatch[1]
    if (src.startsWith('http')) addIfValid(src.replace(/&amp;/g, '&'))
    else if (src.startsWith('//')) addIfValid(`https:${src}`)
  }

  return Array.from(urls).slice(0, MAX_EXTRACTED_IMAGES)
}

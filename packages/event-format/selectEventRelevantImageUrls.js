/**
 * Filter image URLs to only those likely to be event posters or event photos.
 * Used when adding an event via link - excludes logos, icons, decorations.
 */
import OpenAI from 'openai'

const DEFAULT_MODEL = 'gpt-4o-mini'
const MAX_ATTEMPTS = 2
const MAX_PAGE_CONTENT_CHARS = 12_000
const MAX_IMAGE_URLS = 5
const LOG_PREFIX = '[event-format][selectEventRelevantImageUrls]'

function log(ctx, level, message, data) {
  const parts = [LOG_PREFIX]
  if (ctx) parts.push(ctx)
  parts.push(message)
  if (data && Object.keys(data).length > 0) parts.push(JSON.stringify(data))
  const line = parts.join(' ')
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}

function isRetryableOpenAIError(err) {
  const status = err?.status
  if (status === 429) return true
  if (status === 408) return true
  if (typeof status === 'number' && status >= 500) return true
  return false
}

const SELECT_IMAGES_SCHEMA = {
  name: 'select_event_images',
  strict: true,
  schema: {
    type: 'object',
    required: ['urls'],
    additionalProperties: false,
    properties: {
      urls: {
        type: 'array',
        items: { type: 'string' },
        maxItems: MAX_IMAGE_URLS,
      },
    },
  },
}

const SYSTEM_PROMPT = `You are given the text content of an event webpage and a list of image URLs found on that page.

Your task: Return ONLY the URLs that are likely the main event poster or event photos. Exclude:
- Logos (site logo, brand logo)
- Icons (social media icons, UI icons, favicons)
- Decorations (background images, decorative banners)
- Cookie/GDPR banners
- Avatars or profile pictures
- Small thumbnails that are clearly not the main event image

Include:
- The main event poster/cover image (often og:image or hero image)
- Event photos from the page content
- Up to 5 URLs maximum, in order of relevance (main poster first)

Return a JSON object with a "urls" array containing only the relevant image URLs. Use the EXACT URLs from the input list - do not modify them. If none are event-relevant, return an empty array.`

/**
 * Select event-relevant image URLs from candidates using OpenAI.
 * @param {string} pageText - Page text (from HTML conversion)
 * @param {string[]} imageUrls - Candidate image URLs from the page
 * @param {{ openaiApiKey?: string, openaiModel?: string, correlationId?: string }} [options]
 * @returns {Promise<{ success: true, urls: string[] } | { success: false }>}
 */
export async function selectEventRelevantImageUrls(pageText, imageUrls, options = {}) {
  const apiKey = (options.openaiApiKey ?? process.env.OPENAI_API_KEY ?? '').trim()
  const model = (options.openaiModel ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL
  const correlationId = options.correlationId

  if (!apiKey) {
    log(correlationId, 'warn', 'selectEventRelevantImageUrls: no OpenAI API key')
    return { success: false }
  }

  const urls = Array.isArray(imageUrls) ? imageUrls.filter((u) => typeof u === 'string' && u.trim()) : []
  if (urls.length === 0) {
    return { success: true, urls: [] }
  }

  const truncatedPage = typeof pageText === 'string' && pageText.trim()
    ? pageText.trim().slice(0, MAX_PAGE_CONTENT_CHARS)
    : ''
  const userContent = `Event page content (for context):

${truncatedPage}

---
Image URLs found on the page (return only those that are event posters/photos):

${urls.map((u, i) => `${i + 1}. ${u}`).join('\n')}`

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const openai = new OpenAI({ apiKey, timeout: 30_000 })
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: SELECT_IMAGES_SCHEMA,
        },
        max_tokens: 1500,
        temperature: 0.1,
      })

      const content = response.choices[0]?.message?.content?.trim() ?? ''
      if (!content) {
        log(correlationId, 'warn', 'selectEventRelevantImageUrls: AI returned empty', { attempt })
        if (attempt < MAX_ATTEMPTS) continue
        return { success: true, urls: [] }
      }

      const parsed = JSON.parse(content)
      const urlSet = new Set(urls.map((u) => u.trim()))
      const selected = Array.isArray(parsed.urls)
        ? parsed.urls
            .filter((u) => typeof u === 'string' && urlSet.has(u.trim()))
            .slice(0, MAX_IMAGE_URLS)
        : []
      log(correlationId, 'info', 'selectEventRelevantImageUrls: success', {
        attempt,
        inputCount: urls.length,
        outputCount: selected.length,
      })
      return { success: true, urls: selected }
    } catch (err) {
      const msg = err?.message ?? String(err)
      log(correlationId, 'error', 'selectEventRelevantImageUrls: OpenAI error', { attempt, message: msg })
      if (attempt < MAX_ATTEMPTS && isRetryableOpenAIError(err)) {
        await new Promise((r) => setTimeout(r, 1000 * attempt))
        continue
      }
      return { success: true, urls: [] }
    }
  }

  return { success: true, urls: [] }
}

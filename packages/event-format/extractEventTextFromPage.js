/**
 * Extract event-relevant text from a webpage's content using OpenAI.
 * Used when user selects "הוספה באמצעות קישור" and sends a URL.
 * The page content (HTML converted to text) is sent to the AI, which returns only
 * the text relevant to the event, preserving format and content as on the website.
 */
import OpenAI from 'openai'

const DEFAULT_MODEL = 'gpt-4o-mini'
const MAX_ATTEMPTS = 3
const MAX_PAGE_CONTENT_CHARS = 50_000
const LOG_PREFIX = '[event-format][extractEventTextFromPage]'

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

const SYSTEM_PROMPT = `You are given the text content of a webpage that may contain an event (concert, show, workshop, etc.) along with navigation, ads, footer, and other irrelevant content.

Your task: Extract ONLY the text that is relevant to the event. Include:
- Event title/name
- Date(s) and time(s)
- Location (venue, city, address)
- Price or "free entry" info
- Full description
- Links (tickets, website, etc.)
- Any other event-specific details

Rules:
- Keep the EXACT same format and content as on the website. Do not paraphrase, summarize, or change wording.
- Do not add anything that was not on the page.
- Remove navigation, footer, ads, cookie notices, and other non-event content.
- Preserve line breaks, headings, and structure of the event content.
- If the page does not contain event information, return an empty string.`

/**
 * Extract event-relevant text from webpage content using OpenAI.
 * @param {string} pageContent - Full page text (from HTML conversion)
 * @param {{ openaiApiKey?: string, openaiModel?: string, correlationId?: string, sourceUrl?: string }} [options]
 * @returns {Promise<{ success: true, text: string } | { success: false, errorReason: string }>}
 */
export async function extractEventTextFromPage(pageContent, options = {}) {
  const apiKey = (options.openaiApiKey ?? process.env.OPENAI_API_KEY ?? '').trim()
  const model = (options.openaiModel ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL
  const correlationId = options.correlationId
  const sourceUrl = typeof options.sourceUrl === 'string' ? options.sourceUrl.trim() : ''

  if (!apiKey) {
    log(correlationId, 'warn', 'extractEventTextFromPage: no OpenAI API key')
    return { success: false, errorReason: 'no_openai_key' }
  }

  const content = typeof pageContent === 'string' ? pageContent.trim() : ''
  if (!content || content.length < 50) {
    return { success: false, errorReason: 'empty_content' }
  }

  const truncated = content.length > MAX_PAGE_CONTENT_CHARS ? content.slice(0, MAX_PAGE_CONTENT_CHARS) : content

  const userContent = sourceUrl
    ? `Extract the event-relevant text from this webpage content. The user shared this URL: ${sourceUrl}

At the end of your output, add a line: קישור: [title] - ${sourceUrl}
Replace [title] with a short Hebrew label (e.g. לעמוד האירוע, לרכישת כרטיסים, לאיוונט בפייסבוק, לאתר האירוע) based on what the page is.

Webpage content:

${truncated}`
    : `Extract the event-relevant text from this webpage content:

${truncated}`

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const openai = new OpenAI({ apiKey, timeout: 60_000 })
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        max_tokens: 4000,
        temperature: 0.1,
      })

      const text = response.choices[0]?.message?.content?.trim() ?? ''
      if (!text) {
        log(correlationId, 'warn', 'extractEventTextFromPage: AI returned empty', { attempt })
        if (attempt < MAX_ATTEMPTS) continue
        return { success: false, errorReason: 'ai_empty_response' }
      }

      log(correlationId, 'info', 'extractEventTextFromPage: success', { attempt, textLength: text.length })
      return { success: true, text }
    } catch (err) {
      const status = err?.status
      const msg = err?.message ?? String(err)
      log(correlationId, 'error', 'extractEventTextFromPage: OpenAI error', { attempt, status, message: msg })
      if (attempt < MAX_ATTEMPTS && isRetryableOpenAIError(err)) {
        const delay = 1000 * attempt
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      return { success: false, errorReason: `openai_failed: ${msg}` }
    }
  }

  return { success: false, errorReason: 'openai_no_result_after_retries' }
}

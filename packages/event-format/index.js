/**
 * @galiluz/event-format — Publisher event formatting via OpenAI.
 * Used by wa-bot only. Accepts rawEventWithAll and categoriesList; returns formattedEvent or errorReason.
 * Nuxt validates the result when wa-bot POSTs it.
 */
import OpenAI from 'openai'
import { PUBLISHER_EVENT_FORMAT_SCHEMA } from './schema.js'
import { getCurrentIsraelUtcOffset } from './israelDate.js'
import { sanitizeRawEventForPrompt } from './promptSanitize.js'
import { extractNavLinksFromRaw } from './navLinks.js'
import { convertMessageToHtml } from './whatsappFormatToHtml.js'

const DEFAULT_MODEL = 'gpt-4o-mini'
const MAX_ATTEMPTS = 3
const MAX_USER_CONTENT_CHARS = 16_000
const LOG_PREFIX = '[event-format]'

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

function getIsraelDateContext() {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value ?? ''
  const month = parts.find((p) => p.type === 'month')?.value ?? ''
  const day = parts.find((p) => p.type === 'day')?.value ?? ''
  const offset = getCurrentIsraelUtcOffset()
  return `Current date (Israel, Asia/Jerusalem): ${year}-${month}-${day}. Use this to resolve relative dates in rawOccurrences.
Current Israel UTC offset: UTC+${offset}. Convert Israel times to UTC by subtracting this offset (e.g. 10:00 Israel → ${10 - offset}:00 UTC, 15:00 Israel → ${15 - offset}:00 UTC). Use the offset that applies to each occurrence date (Israel is UTC+2 in winter, UTC+3 in summer/DST).`
}

function buildSystemPrompt(categoriesList) {
  const categoriesText = categoriesList.map((c) => `- ${c.id}: ${c.label}`).join('\n')
  return `You are a formatting assistant for publisher-submitted event data (Hebrew community events calendar). The input is structured data that the publisher already provided via a form — NOT a random WhatsApp message. Your job is to format and validate only; do NOT infer or add information the publisher did not provide.

OUTPUT LANGUAGE: All generated text (shortDescription, urls titles, etc.) must be in Hebrew by default. Use English only when the original raw data (rawTitle, rawFullDescription, rawUrls) is clearly in English; otherwise output Hebrew.

RULES:
1. Use the full raw event object only as context (keys: rawTitle, rawOccurrences, rawCity, rawLocationName, rawAddressLine1, rawAddressLine2, rawLocationDetails, rawNavLinks, rawPrice, rawFullDescription, rawUrls, rawMainCategory, rawCategories, rawMedia). Output only the fields defined in the schema.
2. rawOccurrences: Parse into occurrences. All times are Israel (Asia/Jerusalem). Hebrew afternoon: "1 בצהריים" = 13:00, "2 בצהריים" = 14:00, "3 בצהריים" = 15:00, "4 בצהריים" = 16:00, etc. Convert Israel time to UTC (Israel is UTC+2 in winter, UTC+3 in summer/DST — use the offset that applies to the occurrence date). Each occurrence: date = YYYY-MM-DD (Israel), hasTime = true if a specific time was given else false, startTime = ISO 8601 UTC string (if hasTime: combine date with time in Israel then convert to UTC; if !hasTime: use Israel midnight for that date in UTC), endTime = ISO UTC or null if not given.
3. city: The publisher provided a city. Fix common Israeli place name typos (e.g. "קריעת שמונה" → "קריית שמונה", ת"א → תל אביב). Do not change correct names; only normalize obvious misspellings. Do not infer a different city. Example: קריעת שמונה → קריית שמונה.
4. price: Convert to number or null. Free entry (e.g. חינם, בחינם, free, כניסה חופשית, ללא תשלום, אין תשלום) → 0. Ignore a number only when it is clearly not the event price (e.g. merchandise, food at event). If unclear or not a single number, use null.
5. shortDescription: Write in Hebrew (1–2 sentences) unless the event description was in English. Base only on the provided description. Do not add details that are not in the description.
6. categories: mainCategory is already provided in the raw event — it MUST be included in the categories array. Add up to 3 additional category ids ONLY from the list below when the event clearly fits (e.g. both music and party). Do not add categories the publisher did not intend. Use ONLY these ids:
7. urls: From rawUrls and any URLs or phone numbers in rawFullDescription, produce an array of {Title, Url, type}. type = "link" for web URLs (https://...), type = "phone" for phone numbers. Title = short Hebrew label (e.g. "כרטיסים", "ניווט Waze", "טלפון להרשמה"). Url = the clean URL or the phone number (digits, optional formatting). Include both links and phone numbers that appear in the text with an appropriate title. If none, return empty array.

${categoriesText}`
}

function buildLeanPayloadForPrompt(raw) {
  const rawMedia = Array.isArray(raw.rawMedia) ? raw.rawMedia : []
  const leanMedia = rawMedia.map((m) => {
    const item = m && typeof m === 'object' ? m : {}
    return {
      cloudinaryURL: item.cloudinaryURL ?? '',
      isMain: item.isMain ?? false,
    }
  })
  const lean = { ...raw, rawMedia: leanMedia }
  return sanitizeRawEventForPrompt(lean)
}

function isRetryableOpenAIError(err) {
  const status = err?.status
  if (status === 429) return true
  if (status === 408) return true
  if (typeof status === 'number' && status >= 500) return true
  return false
}

function getRetryDelayMs(err, attemptIndex) {
  const status = err?.status
  const message = err?.message
  if (status === 429 && message) {
    const match = String(message).match(/try again in (\d+)ms/i)
    if (match) return Math.min(60_000, Math.max(500, Number(match[1])))
    return 2000
  }
  const backoff = 1000 * 2 ** attemptIndex
  return Math.min(30_000, backoff)
}

function isValidAIResult(parsed) {
  if (!parsed || typeof parsed !== 'object') return false
  const p = parsed
  if (typeof p.shortDescription !== 'string') return false
  if (!Array.isArray(p.categories) || p.categories.length === 0) return false
  if (!Array.isArray(p.occurrences) || p.occurrences.length === 0) return false
  if (typeof p.city !== 'string') return false
  if (p.price !== null && (typeof p.price !== 'number' || !Number.isFinite(p.price))) return false
  if (!Array.isArray(p.urls)) return false
  for (const u of p.urls) {
    if (!u || typeof u !== 'object' || typeof u.Title !== 'string' || typeof u.Url !== 'string') return false
    if (u.type !== undefined && u.type !== 'link' && u.type !== 'phone') return false
  }
  return true
}

async function callOpenAIForPublisherFormat(rawEventWithAll, categoriesList, dateContext, correlationId, openai, model) {
  const inputSummary = {
    rawTitleLength: typeof rawEventWithAll.rawTitle === 'string' ? rawEventWithAll.rawTitle.trim().length : 0,
    rawOccurrencesLength: typeof rawEventWithAll.rawOccurrences === 'string' ? rawEventWithAll.rawOccurrences.trim().length : 0,
    rawMainCategory: rawEventWithAll.rawMainCategory ?? '(empty)',
    rawCity: typeof rawEventWithAll.rawCity === 'string' ? rawEventWithAll.rawCity : '(empty)',
  }
  const systemPrompt = buildSystemPrompt(categoriesList)
  const leanPayload = buildLeanPayloadForPrompt(rawEventWithAll)
  let userContent = `${dateContext}\n\nFull raw event (publisher-submitted) — use as context:\n${JSON.stringify(leanPayload, null, 2)}`
  const truncated = userContent.length > MAX_USER_CONTENT_CHARS
  if (truncated) userContent = userContent.slice(0, MAX_USER_CONTENT_CHARS) + '\n\n[... truncated for length]'

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    log(correlationId, 'info', `OpenAI attempt ${attempt}/${MAX_ATTEMPTS}`, attempt === 1 ? { ...inputSummary, model, userContentTruncated: truncated } : { attempt })
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: PUBLISHER_EVENT_FORMAT_SCHEMA,
        },
        max_tokens: 2000,
        temperature: 0.1,
      })
      const content = response.choices[0]?.message?.content
      if (!content) {
        log(correlationId, 'warn', 'OpenAI returned empty content', { attempt })
        return { result: null, errorReason: 'openai_empty_content' }
      }
      let parsed
      try {
        parsed = JSON.parse(content)
      } catch {
        log(correlationId, 'error', 'invalid JSON in response', { attempt, contentLength: content.length })
        return { result: null, errorReason: 'openai_invalid_json' }
      }
      if (isValidAIResult(parsed)) {
        log(correlationId, 'info', 'OpenAI response valid', {
          occurrencesCount: parsed.occurrences.length,
          city: parsed.city,
          price: parsed.price,
          categoriesCount: parsed.categories.length,
        })
        return { result: parsed }
      }
      log(correlationId, 'error', 'response shape invalid', { attempt })
      return { result: null, errorReason: 'openai_response_shape_invalid' }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const status = err?.status
      log(correlationId, 'error', 'OpenAI request failed', { attempt, error: msg, status, retryable: isRetryableOpenAIError(err) })
      if (attempt < MAX_ATTEMPTS && isRetryableOpenAIError(err)) {
        const delay = getRetryDelayMs(err, attempt - 1)
        log(correlationId, 'info', `retrying in ${delay}ms`, { attempt, nextAttempt: attempt + 1 })
        await new Promise((r) => setTimeout(r, delay))
      } else {
        return { result: null, errorReason: `openai_request_failed: ${msg}` }
      }
    }
  }
  return { result: null, errorReason: 'openai_no_result_after_retries' }
}

/**
 * Format a publisher raw event into a full event object using OpenAI.
 * Returns { formattedEvent } on success or { formattedEvent: null, errorReason } on failure.
 * Nuxt validates the result when wa-bot POSTs it; this package does minimal shape check only.
 *
 * @param {object} rawEventWithAll - Raw event with rawTitle, rawOccurrences, rawMedia, publisher, etc.
 * @param {Array<{id: string, label: string}>} categoriesList - From GET /api/categories
 * @param {{ correlationId?: string, openaiApiKey?: string, openaiModel?: string }} [options]
 */
export async function formatPublisherEvent(rawEventWithAll, categoriesList, options = {}) {
  const correlationId = options.correlationId
  const apiKey = (options.openaiApiKey ?? process.env.OPENAI_API_KEY ?? '').trim()
  const model = (options.openaiModel ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL

  if (!categoriesList?.length) {
    log(correlationId, 'error', 'skipped: categories list is empty', { reason: 'empty_categories_list' })
    return { formattedEvent: null, errorReason: 'empty_categories_list' }
  }
  if (!apiKey) {
    log(correlationId, 'warn', 'skipped: no OpenAI API key', { reason: 'no_openai_key' })
    return { formattedEvent: null, errorReason: 'no_openai_key' }
  }

  const openai = new OpenAI({ apiKey, timeout: 60_000 })
  const dateContext = getIsraelDateContext()
  const aiCall = await callOpenAIForPublisherFormat(rawEventWithAll, categoriesList, dateContext, correlationId, openai, model)
  if (!aiCall.result) {
    return { formattedEvent: null, errorReason: `OpenAI format failed (${aiCall.errorReason})` }
  }
  const aiResult = aiCall.result

  const publisher = rawEventWithAll.publisher
  const title = typeof rawEventWithAll.rawTitle === 'string' ? rawEventWithAll.rawTitle.trim() : ''
  const descriptionRaw = typeof rawEventWithAll.rawFullDescription === 'string' ? rawEventWithAll.rawFullDescription : ''
  const fullDescription = convertMessageToHtml(descriptionRaw)
  const navLinksRaw =
    typeof rawEventWithAll.rawNavLinks === 'string' && rawEventWithAll.rawNavLinks.trim()
      ? rawEventWithAll.rawNavLinks.trim()
      : undefined
  const navLinks = extractNavLinksFromRaw(navLinksRaw, navLinksRaw)

  const validCategoryIds = categoriesList.map((c) => c.id)
  let categories = Array.isArray(aiResult.categories) && aiResult.categories.length > 0 ? aiResult.categories : [rawEventWithAll.rawMainCategory || 'community_meetup']
  categories = categories.filter((c) => validCategoryIds.includes(c))
  if (categories.length === 0) {
    categories = [rawEventWithAll.rawMainCategory || 'community_meetup'].filter((c) => validCategoryIds.includes(c))
    if (categories.length === 0) categories = ['community_meetup']
  }
  let mainCategory = rawEventWithAll.rawMainCategory || aiResult.categories?.[0] || 'community_meetup'
  if (!categories.includes(mainCategory)) mainCategory = categories[0]

  const event = {
    Title: title || 'אירוע',
    shortDescription: typeof aiResult.shortDescription === 'string' ? aiResult.shortDescription : '',
    fullDescription,
    mainCategory,
    categories,
    location: {
      City: aiResult.city ?? rawEventWithAll.rawCity ?? '',
      locationName: typeof rawEventWithAll.rawLocationName === 'string' && rawEventWithAll.rawLocationName.trim() ? rawEventWithAll.rawLocationName.trim() : undefined,
      addressLine1: rawEventWithAll.rawAddressLine1 ?? null,
      addressLine2: rawEventWithAll.rawAddressLine2 ?? null,
      locationDetails: rawEventWithAll.rawLocationDetails ?? null,
      wazeNavLink: navLinks.wazeNavLink ?? null,
      gmapsNavLink: navLinks.gmapsNavLink ?? null,
    },
    occurrences: aiResult.occurrences,
    price: aiResult.price,
    media: Array.isArray(rawEventWithAll.rawMedia) ? rawEventWithAll.rawMedia : [],
    urls: Array.isArray(aiResult.urls)
      ? aiResult.urls
          .filter((u) => typeof u?.Title === 'string' && typeof u?.Url === 'string')
          .map((u) => ({ Title: u.Title, Url: u.Url, type: u.type === 'phone' ? 'phone' : 'link' }))
      : [],
    publisherPhone: typeof publisher?.phone === 'string' ? publisher.phone : undefined,
    publisherName: typeof publisher?.name === 'string' ? publisher.name : undefined,
  }

  if (!event.occurrences?.length) {
    log(correlationId, 'error', 'merged event has no occurrences')
    return { formattedEvent: null, errorReason: 'validation failed: no occurrences' }
  }
  log(correlationId, 'info', 'format complete', {
    occurrencesCount: event.occurrences.length,
    city: event.location.City,
    mainCategory: event.mainCategory,
    price: event.price,
  })
  return { formattedEvent: event }
}

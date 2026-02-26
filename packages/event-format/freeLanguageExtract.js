/**
 * Free-language event detection and extraction for wa-bot add flow.
 * Used when publisher pastes a single message with event details.
 */
import OpenAI from 'openai'
import { convertMessageToHtml } from './whatsappFormatToHtml.js'
import { getCurrentIsraelUtcOffset } from './israelDate.js'

const DEFAULT_MODEL = 'gpt-4o-mini'
const MAX_ATTEMPTS = 3
const MAX_TEXT_LENGTH = 8000
const LOG_PREFIX = '[event-format][freeLang]'

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
  return `Current date (Israel, Asia/Jerusalem): ${year}-${month}-${day}. Use this to resolve relative dates.
Current Israel UTC offset: UTC+${offset}. Convert Israel times to UTC by subtracting this offset.`
}

function sanitizeText(text) {
  if (!text || typeof text !== 'string') return ''
  let s = text.trim()
  if (s.length > MAX_TEXT_LENGTH) s = s.slice(0, MAX_TEXT_LENGTH)
  return s
}

const DETECTION_SCHEMA = {
  name: 'free_lang_detection',
  strict: true,
  schema: {
    type: 'object',
    required: ['isEvent', 'reason'],
    additionalProperties: false,
    properties: {
      isEvent: { type: 'boolean' },
      reason: { type: ['string', 'null'] },
    },
  },
}

const DETECTION_SYSTEM_PROMPT = `You are an assistant for a Hebrew community events calendar. Determine if a WhatsApp message describes an EVENT (a specific gathering, activity, or happening with date/time and location).

RULES (relaxed — prefer isEvent true when in doubt):
- If the message describes any event (concert, workshop, meetup, party, etc.) even without all details, set isEvent to true.
- Only set isEvent to false when: spam, irrelevant content, business hours/menus, generic ads with no event, or text that clearly does not describe any event.
- Partial event info (e.g. only title and date, missing price) still counts as an event.
- reason: null when isEvent is true. When isEvent is false, provide short Hebrew reason.`

/**
 * Detect if the message describes an event. Relaxed vs wa-listener: accepts partial event descriptions.
 * @param {string} text - Raw user message
 * @param {{ openaiApiKey?: string, openaiModel?: string, correlationId?: string }} [options]
 * @returns {Promise<{ isEvent: boolean, reason?: string | null }>}
 */
export async function detectEventFromFreeText(text, options = {}) {
  const apiKey = (options.openaiApiKey ?? process.env.OPENAI_API_KEY ?? '').trim()
  const model = (options.openaiModel ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL
  const correlationId = options.correlationId

  if (!apiKey) {
    log(correlationId, 'warn', 'detectEventFromFreeText: no OpenAI API key')
    return { isEvent: false, reason: 'שירות לא זמין' }
  }

  const userContent = sanitizeText(text)
  if (!userContent) {
    return { isEvent: false, reason: 'הודעה ריקה' }
  }

  try {
    const openai = new OpenAI({ apiKey, timeout: 15_000 })
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: DETECTION_SYSTEM_PROMPT },
        { role: 'user', content: `Does this message describe an event?\n\n${userContent}` },
      ],
      response_format: { type: 'json_schema', json_schema: DETECTION_SCHEMA },
      max_tokens: 150,
      temperature: 0.1,
    })
    const content = response.choices[0]?.message?.content
    if (!content) {
      log(correlationId, 'warn', 'detectEventFromFreeText: empty content')
      return { isEvent: false, reason: 'לא התקבלה תשובה' }
    }
    const parsed = JSON.parse(content)
    const isEvent = parsed.isEvent === true
    const reason = parsed.reason != null ? String(parsed.reason).trim() || null : null
    log(correlationId, 'info', 'detectEventFromFreeText: ok', { isEvent, reason })
    return { isEvent, reason }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log(correlationId, 'error', 'detectEventFromFreeText failed', { error: msg })
    return { isEvent: false, reason: `שגיאה: ${msg}` }
  }
}

const FREE_LANG_FLAG_KEYS = ['rawOccurrences', 'rawPrice', 'rawLocation', 'rawMainCategory', 'rawCity']

const EXTRACTION_SCHEMA = {
  name: 'free_lang_extraction',
  strict: true,
  schema: {
    type: 'object',
    required: [
      'rawTitle',
      'rawOccurrences',
      'rawFullDescription',
      'rawMainCategory',
      'rawPrice',
      'rawCity',
      'rawLocationName',
      'rawAddressLine1',
      'rawAddressLine2',
      'rawNavLinks',
      'rawUrls',
      'occurrences',
      'price',
      'shortDescription',
      'mainCategory',
      'categories',
      'city',
      'cityType',
      'cityId',
      'locationName',
      'addressLine1',
      'addressLine2',
      'locationDetails',
      'wazeNavLink',
      'gmapsNavLink',
      'urls',
      'flags',
    ],
    additionalProperties: false,
    properties: {
      rawTitle: { type: 'string' },
      rawOccurrences: { type: 'string' },
      rawFullDescription: { type: 'string' },
      rawMainCategory: { type: 'string' },
      rawPrice: { type: 'string' },
      rawCity: { type: 'string' },
      rawLocationName: { type: 'string' },
      rawAddressLine1: { type: 'string' },
      rawAddressLine2: { type: 'string' },
      rawNavLinks: { type: 'string' },
      rawUrls: { type: 'string' },
      occurrences: {
        type: 'array',
        minItems: 0,
        items: {
          type: 'object',
          required: ['date', 'hasTime', 'startTime', 'endTime'],
          additionalProperties: false,
          properties: {
            date: { type: 'string' },
            hasTime: { type: 'boolean' },
            startTime: { type: 'string' },
            endTime: { type: ['string', 'null'] },
          },
        },
      },
      price: { type: ['number', 'null'] },
      shortDescription: { type: 'string' },
      mainCategory: { type: 'string' },
      categories: { type: 'array', items: { type: 'string' }, minItems: 0 },
      city: { type: 'string' },
      cityType: { type: 'string', enum: ['listed', 'custom', ''] },
      cityId: { type: ['string', 'null'] },
      locationName: { type: ['string', 'null'] },
      addressLine1: { type: ['string', 'null'] },
      addressLine2: { type: ['string', 'null'] },
      locationDetails: { type: ['string', 'null'] },
      wazeNavLink: { type: ['string', 'null'] },
      gmapsNavLink: { type: ['string', 'null'] },
      urls: {
        type: 'array',
        items: {
          type: 'object',
          required: ['Title', 'Url', 'type'],
          additionalProperties: false,
          properties: {
            Title: { type: 'string' },
            Url: { type: 'string' },
            type: { type: 'string', enum: ['link', 'phone'] },
          },
        },
      },
      flags: {
        type: 'array',
        items: {
          type: 'object',
          required: ['fieldKey', 'reason'],
          additionalProperties: false,
          properties: {
            fieldKey: { type: 'string', enum: FREE_LANG_FLAG_KEYS },
            reason: { type: 'string' },
          },
        },
      },
    },
  },
}

const MAX_EXTRA_CATEGORIES = 3

function buildExtractionSystemPrompt(categoriesList, citiesList, dateContext) {
  const categoriesText = categoriesList.map((c) => `- ${c.id}: ${c.label}`).join('\n')
  const citiesSample = citiesList.slice(0, 30).map((c) => c.title).join(', ')
  return `You extract event data from a single WhatsApp message (Hebrew community events calendar).

${dateContext}

CATEGORIES (you MUST use ONLY these ids — mainCategory + categories):
${categoriesText}

CITIES: Match to listed cities when possible. Sample: ${citiesSample}
When city matches a known city, set cityType="listed" and cityId to the city id. Otherwise cityType="custom".

NORTHERN ISRAEL ONLY: This calendar is for Northern Israel only (הגליל העליון, רמת הגולן, אצבע הגליל). If you have NO DOUBT that the extracted city is NOT in Northern Israel (e.g. clearly תל אביב, ירושלים, באר שבע, נתניה, ראשון לציון), do NOT save it: set rawCity and city to empty string, cityType to "", cityId to null. Add flag: fieldKey="rawCity", reason="העיר שזוהתה אינה באזור הצפון". When in doubt, accept the city — only flag when you are certain it is outside the North.

RULES:
1. rawTitle: Event name only. No price, dates, location (unless clearly part of event name). Generate from content if no clear title.
2. rawFullDescription: Preserve the message segment as description. Keep WhatsApp formatting (* _ ~) and emojis. Remove raw URLs; min 70 chars. Do not include link titles.
3. shortDescription: 1-2 sentences Hebrew, no location/price/dates.
4. rawOccurrences: String representation of dates/times from message (e.g. "25/02 20:00" or "5 במרץ משמונה עד 10").
5. occurrences: Structured array. date=YYYY-MM-DD, startTime/endTime=ISO UTC. Israel timezone.
6. rawPrice: String from message (e.g. "50" or "חינם"). price: number or 0 (free) or null.
7. mainCategory/categories: ALWAYS try to infer from content first (event type, topic, keywords). Use the category list above. mainCategory = primary best-fit. categories = [mainCategory] + up to ${MAX_EXTRA_CATEGORIES} additional ids ONLY when the event clearly fits (e.g. concert → music + show). Do not add extras unless the event genuinely matches multiple categories. Only flag rawMainCategory when you truly cannot infer any suitable category (e.g. completely generic "אירוע" with zero context).
8. location: Extract locationName, addressLine1, addressLine2, wazeNavLink, gmapsNavLink. rawLocationName/rawAddressLine1 = raw strings.
9. urls: Event links and phones only. type=link|phone. Exclude Waze/Gmaps (those go to rawNavLinks).
10. rawNavLinks: Newline-separated Waze and Google Maps URLs if present. Else "".
11. rawUrls: Newline-separated other URLs and phone numbers. Else "".

FLAGS: Add to flags ONLY when UNABLE to extract OR when you are CERTAIN the city is outside Northern Israel (per rule above — when in doubt, do not flag rawCity). Flag rawOccurrences when no date/time. Flag rawPrice when no price nor free. Flag rawLocation when BOTH locationName AND addressLine1/addressLine2 are empty. Flag rawMainCategory ONLY when category truly cannot be inferred from content.
Include ALL qualifying flags. reason = short Hebrew explanation.`
}

/**
 * Extract structured event data from free-language message.
 * Returns rawEventSupplement (for buildRawEvent), formattedEvent (for preview), and flags.
 * @param {string} text - Raw user message
 * @param {Array<{id: string, label: string}>} categoriesList
 * @param {Array<{id: string, title: string, region: string}>} citiesList
 * @param {{ openaiApiKey?: string, openaiModel?: string, correlationId?: string }} [options]
 * @returns {Promise<{ rawEventSupplement: object, formattedEvent: object, flags: Array<{fieldKey: string, reason: string}> } | { rawEventSupplement: null, formattedEvent: null, flags: [], errorReason: string }>}
 */
export async function extractEventFromFreeText(text, categoriesList, citiesList, options = {}) {
  const apiKey = (options.openaiApiKey ?? process.env.OPENAI_API_KEY ?? '').trim()
  const model = (options.openaiModel ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL
  const correlationId = options.correlationId

  if (!apiKey) {
    log(correlationId, 'warn', 'extractEventFromFreeText: no OpenAI API key')
    return { rawEventSupplement: null, formattedEvent: null, flags: [], errorReason: 'no_openai_key' }
  }
  if (!categoriesList?.length) {
    log(correlationId, 'error', 'extractEventFromFreeText: empty categories')
    return { rawEventSupplement: null, formattedEvent: null, flags: [], errorReason: 'empty_categories_list' }
  }

  const userContent = sanitizeText(text)
  if (!userContent) {
    return { rawEventSupplement: null, formattedEvent: null, flags: [], errorReason: 'empty_input' }
  }

  const messageHtml = convertMessageToHtml(userContent)
  const dateContext = getIsraelDateContext()
  const systemPrompt = buildExtractionSystemPrompt(categoriesList, citiesList || [], dateContext)

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const openai = new OpenAI({ apiKey, timeout: 60_000 })
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract event from this message (HTML below):\n\n${messageHtml || userContent}` },
        ],
        response_format: { type: 'json_schema', json_schema: EXTRACTION_SCHEMA },
        max_tokens: 2500,
        temperature: 0.1,
      })
      const content = response.choices[0]?.message?.content
      if (!content) {
        log(correlationId, 'warn', 'extractEventFromFreeText: empty content', { attempt })
        continue
      }
      const parsed = JSON.parse(content)

      const rawEventSupplement = {
        rawTitle: (parsed.rawTitle ?? '').trim(),
        rawOccurrences: (parsed.rawOccurrences ?? '').trim(),
        rawFullDescription: (parsed.rawFullDescription ?? '').trim(),
        rawMainCategory: (parsed.rawMainCategory ?? '').trim() || 'community_meetup',
        rawPrice: (parsed.rawPrice ?? '').trim(),
        rawCity: (parsed.rawCity ?? '').trim() || undefined,
        rawCityId: parsed.cityId ?? undefined,
        rawCityType: parsed.cityType === 'listed' || parsed.cityType === 'custom' ? parsed.cityType : undefined,
        rawLocationName: (parsed.rawLocationName ?? parsed.locationName ?? '').trim() || undefined,
        rawAddressLine1: (parsed.rawAddressLine1 ?? parsed.addressLine1 ?? '').trim() || undefined,
        rawAddressLine2: (parsed.rawAddressLine2 ?? parsed.addressLine2 ?? '').trim() || undefined,
        rawLocationDetails: (parsed.locationDetails ?? '').trim() || undefined,
        rawNavLinks: (parsed.rawNavLinks ?? '').trim() || undefined,
        rawUrls: (parsed.rawUrls ?? '').trim() || undefined,
      }

      const validCategoryIds = new Set(categoriesList.map((c) => c.id))
      let mainCategory = (parsed.mainCategory ?? '').trim()
      if (!validCategoryIds.has(mainCategory)) mainCategory = 'community_meetup'
      let categories = Array.isArray(parsed.categories) ? parsed.categories.filter((c) => validCategoryIds.has(c)) : []
      if (!categories.includes(mainCategory)) categories = [mainCategory, ...categories.filter((c) => c !== mainCategory)]
      categories = categories.slice(0, 1 + MAX_EXTRA_CATEGORIES)

      const location = {
        City: (parsed.city ?? '').trim(),
        region: undefined,
        cityId: parsed.cityId ?? undefined,
        cityType: parsed.cityType === 'listed' || parsed.cityType === 'custom' ? parsed.cityType : undefined,
        locationName: parsed.locationName ?? null,
        addressLine1: parsed.addressLine1 ?? null,
        addressLine2: parsed.addressLine2 ?? null,
        locationDetails: parsed.locationDetails ?? null,
        wazeNavLink: parsed.wazeNavLink ?? null,
        gmapsNavLink: parsed.gmapsNavLink ?? null,
      }

      const formattedEvent = {
        Title: (parsed.rawTitle ?? '').trim() || 'אירוע',
        shortDescription: (parsed.shortDescription ?? '').trim() || 'אירוע',
        fullDescription: (parsed.rawFullDescription ?? '').trim() || '',
        mainCategory,
        categories,
        location,
        occurrences: Array.isArray(parsed.occurrences) && parsed.occurrences.length > 0 ? parsed.occurrences : [],
        price: parsed.price,
        urls: Array.isArray(parsed.urls)
          ? parsed.urls.filter((u) => u?.Title && u?.Url).map((u) => ({ Title: u.Title, Url: u.Url, type: u.type === 'phone' ? 'phone' : 'link' }))
          : [],
      }

      const flags = Array.isArray(parsed.flags)
        ? parsed.flags
            .filter((f) => f && FREE_LANG_FLAG_KEYS.includes(f.fieldKey) && typeof f.reason === 'string' && f.reason.trim())
            .map((f) => ({ fieldKey: f.fieldKey, reason: f.reason.trim() }))
        : []

      log(correlationId, 'info', 'extractEventFromFreeText: ok', {
        title: formattedEvent.Title,
        flagsCount: flags.length,
      })
      return { rawEventSupplement, formattedEvent, flags }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log(correlationId, 'error', 'extractEventFromFreeText failed', { attempt, error: msg })
      if (attempt >= MAX_ATTEMPTS) {
        return { rawEventSupplement: null, formattedEvent: null, flags: [], errorReason: `openai_error: ${msg}` }
      }
    }
  }
  return { rawEventSupplement: null, formattedEvent: null, flags: [], errorReason: 'openai_no_result' }
}

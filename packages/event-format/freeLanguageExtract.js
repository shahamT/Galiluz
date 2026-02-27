/**
 * Free-language event detection and extraction for wa-bot add flow.
 * Used when publisher pastes a single message with event details.
 */
import OpenAI from 'openai'
import { convertMessageToHtml } from './whatsappFormatToHtml.js'
import { getCurrentIsraelUtcOffset } from './israelDate.js'
import { normalizeCityToListedOrCustom } from './index.js'

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

/**
 * Strip redundant city name from locationName/addressLine1 when they repeat the city.
 * City is stored in City field; avoid duplication (e.g. locationName "בית הלל" when City is "בית הלל").
 * @param {string} city - City name (from City field)
 * @param {string|null|undefined} locationName
 * @param {string|null|undefined} addressLine1
 * @returns {{ locationName: string|null, addressLine1: string|null }}
 */
function stripCityFromLocationFields(city, locationName, addressLine1) {
  const cityNorm = (city ?? '').trim()
  if (!cityNorm) return { locationName: locationName ?? null, addressLine1: addressLine1 ?? null }
  const norm = (s) => (s ?? '').trim().replace(/\s+/g, ' ')
  const cityLower = norm(cityNorm).toLowerCase()

  const strip = (val) => {
    const v = norm(val)
    if (!v) return null
    const vLower = v.toLowerCase()
    if (vLower === cityLower) return null
    if (vLower.startsWith(cityLower)) {
      const rest = v.slice(cityNorm.length).replace(/^[\s,]+/, '').trim()
      return rest || null
    }
    return v || null
  }

  return {
    locationName: strip(locationName) ?? null,
    addressLine1: strip(addressLine1) ?? null,
  }
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

const FREE_LANG_FLAG_KEYS = ['rawOccurrences', 'rawPrice', 'rawLocation', 'rawMainCategory', 'rawCity', 'rawCityOutsideNorth']

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
  const citiesText = (citiesList || []).map((c) => c.title).join(', ')
  return `You extract event data from a single WhatsApp message (Hebrew community events calendar).

${dateContext}

CATEGORIES (you MUST use ONLY these ids — mainCategory + categories):
${categoriesText}

CITY: Extract the city/town name. Use standard spelling. If the message mentions a city from this list, use that exact name: ${citiesText}. Otherwise use the city name as stated. Fix obvious typos (e.g. קריעת שמונה → קריית שמונה).

NORTHERN ISRAEL ONLY: This calendar is for Northern Israel only (הגליל העליון, רמת הגולן, אצבע הגליל). If you have NO DOUBT that the extracted city is NOT in Northern Israel (e.g. clearly תל אביב, ירושלים, באר שבע, נתניה, ראשון לציון), set city to empty string and add flag: fieldKey="rawCityOutsideNorth", reason="העיר שזוהתה אינה באזור הצפון". When in doubt, accept the city — only flag when you are certain it is outside the North.

RULES:
1. rawTitle: Event name only. No price, dates, location (unless clearly part of event name). Generate from content if no clear title.
2. rawFullDescription: Output as HTML only. Use only these tags: <p>, <br>, <strong>, <em>, <s>, <ul>, <ol>, <li>, <blockquote>, <code>. Use <strong> for bold, <em> for italic, <ul><li> for bullet lists. Do not use * or _ in the output; use only these HTML tags. Min 70 chars. Preserve structure; add formatting (bold, italic, bullets, paragraphs) for readability when helpful. FOR EACH LINK you extract to urls: REMOVE from rawFullDescription both (a) the URL itself and (b) the label/reference text that introduces it (e.g. "אינסטגרם - ", "כרטיסים >> "). Remove any connector (dash, arrows, colon) that only links the label to the URL. KEEP generic phrases like "כרטיסים למטה בלינק" when they do not repeat a specific extracted link. Do NOT add any content that is not in the original text. TYPOS: You may fix clear typos only when 100% certain (e.g. "בילןי נחמד בסופש" → "בילוי נחמד בסופש"). Do NOT change wordplay, puns, or intentional phrasing.
3. shortDescription: 1-2 sentences Hebrew, no location/price/dates.
4. rawOccurrences: String representation of dates/times from message (e.g. "25/02 20:00" or "5 במרץ משמונה עד 10").
5. occurrences: Structured array. date=YYYY-MM-DD, startTime/endTime=ISO UTC. Israel timezone. When multiple times appear for the same date (e.g. "12:00 - פתיחה, 13:00 - הופעה, 15:00 - סעודה"), infer the correct startTime from what the event is advertising: if the whole day/event is advertised, use the first time; if the event is specifically the show or the feast, use that time. Do not default to the first time when the main advertised activity is clearly later (e.g. poster for "הופעה" with "13:00 - הופעה" → use 13:00). endTime: Set only when there is an explicit end time or when duration clearly implies it (e.g. "מתחילים בשעה 6 בערב ל3 שעות" → 21:00). When there is no clear ending time and no implied duration, leave endTime as null.
6. rawPrice: String from message (e.g. "50" or "חינם"). price: number or 0 (free) or null. Use the MAIN/STANDARD price only — NOT last-minute or day-of price (e.g. "50 ש״ח עד למועד האירוע, 60 ש״ח ביום האירוע" → use 50), NOT bundle price (e.g. "100 ש״ח לכרטיס, 180 ש״ח לשני כרטיסים" → use 100). Prefer the single-ticket or advance price when multiple options exist.
7. mainCategory/categories: ALWAYS try to infer from content first (event type, topic, keywords). Use the category list above. mainCategory = primary best-fit. categories = [mainCategory] + up to ${MAX_EXTRA_CATEGORIES} additional ids ONLY when the event clearly fits (e.g. concert → music + show). Do not add extras unless the event genuinely matches multiple categories. Only flag rawMainCategory when you truly cannot infer any suitable category (e.g. completely generic "אירוע" with zero context).
8. location: Extract locationName, addressLine1, addressLine2, wazeNavLink, gmapsNavLink. rawLocationName/rawAddressLine1 = raw strings. IMPORTANT: Do NOT repeat the city name in locationName or addressLine1 — City is stored separately. locationName = venue/place name only (e.g. "מרכז קהילתי", "פאב השכונה"); addressLine1 = street/address or specific detail (e.g. "רחוב הרצל 5"), NOT the city. If the only location info is the city, leave locationName and addressLine1 empty.
9. urls: Event links and phones only. type=link|phone. Exclude Waze/Gmaps (those go to rawNavLinks).
10. rawNavLinks: Newline-separated Waze and Google Maps URLs if present. Else "".
11. rawUrls: Newline-separated other URLs and phone numbers. Else "".

FLAGS: Add to flags ONLY when UNABLE to extract OR when you are CERTAIN the city is outside Northern Israel (per rule above — when in doubt, do not flag rawCityOutsideNorth). Flag rawOccurrences when no date/time. Flag rawPrice when no price nor free. Flag rawLocation when BOTH locationName AND addressLine1/addressLine2 are empty. Flag rawMainCategory ONLY when category truly cannot be inferred from content.
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

      const hasRawCityOutsideNorth = Array.isArray(parsed.flags) && parsed.flags.some(
        (f) => f && f.fieldKey === 'rawCityOutsideNorth',
      )
      const cityStr = (parsed.city ?? parsed.rawCity ?? '').trim()
      const parsedLocationName = (parsed.rawLocationName ?? parsed.locationName ?? '').trim() || null
      const parsedAddressLine1 = (parsed.rawAddressLine1 ?? parsed.addressLine1 ?? '').trim() || null
      const { locationName: strippedLocationName, addressLine1: strippedAddressLine1 } = stripCityFromLocationFields(
        cityStr,
        parsedLocationName,
        parsedAddressLine1,
      )

      let rawCity, rawRegion, rawCityType
      let locCity = ''
      let locRegion
      let locCityType

      if (hasRawCityOutsideNorth) {
        rawCity = undefined
        rawRegion = undefined
        rawCityType = undefined
        locCity = ''
        locRegion = undefined
        locCityType = undefined
      } else {
        const norm = await normalizeCityToListedOrCustom(cityStr, citiesList || [], {
          openaiApiKey: apiKey,
          openaiModel: model,
          correlationId,
        })
        if (norm.type === 'listed') {
          rawCity = norm.value.cityId || undefined
          rawCityType = 'listed'
          rawRegion = undefined
          locCity = norm.value.cityId || ''
          locRegion = undefined
          locCityType = 'listed'
        } else {
          const customCity = (norm.value ?? '').trim() || undefined
          rawCity = customCity
          rawCityType = customCity ? 'custom' : undefined
          rawRegion = customCity ? undefined : undefined
          locCity = customCity || ''
          locRegion = undefined
          locCityType = customCity ? 'custom' : undefined
        }
      }

      const rawEventSupplement = {
        rawTitle: (parsed.rawTitle ?? '').trim(),
        rawOccurrences: (parsed.rawOccurrences ?? '').trim(),
        rawFullDescription: (parsed.rawFullDescription ?? '').trim(),
        rawMainCategory: (parsed.rawMainCategory ?? '').trim() || 'community_meetup',
        rawPrice: (parsed.rawPrice ?? '').trim(),
        rawCity,
        rawRegion,
        rawCityType,
        rawLocationName: strippedLocationName ? (strippedLocationName.trim() || undefined) : undefined,
        rawAddressLine1: strippedAddressLine1 ? (strippedAddressLine1.trim() || undefined) : undefined,
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
        city: locCity || '',
        region: locRegion ?? undefined,
        cityType: locCityType ?? undefined,
        locationName: strippedLocationName,
        addressLine1: strippedAddressLine1,
        addressLine2: parsed.addressLine2 ?? null,
        locationDetails: parsed.locationDetails ?? null,
        wazeNavLink: parsed.wazeNavLink ?? null,
        gmapsNavLink: parsed.gmapsNavLink ?? null,
      }

      const rawDesc = (parsed.rawFullDescription ?? '').trim()
      const looksLikeHtml = rawDesc && /<\w/.test(rawDesc)
      const fullDescriptionValue = rawDesc
        ? (looksLikeHtml ? rawDesc : convertMessageToHtml(rawDesc))
        : ''
      const formattedEvent = {
        Title: (parsed.rawTitle ?? '').trim() || 'אירוע',
        shortDescription: (parsed.shortDescription ?? '').trim() || 'אירוע',
        fullDescription: fullDescriptionValue,
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

/**
 * Free-language event detection and extraction for wa-bot add flow.
 * Used when publisher pastes a single message with event details.
 */
import { convertMessageToHtml } from './whatsappFormatToHtml.js'
import { normalizeCityToListedOrCustom } from './index.js'
import { normalizeFormattedEventOccurrences } from './occurrenceUtils.js'
import { OCCURRENCE_RULES } from './occurrenceRules.js'
import { isRetryableOpenAIError, getRetryDelayMs, sleep, describeOpenAIError } from './openaiRetry.js'
import { createOpenAIClient } from './openaiClient.js'
import { stripCityFromLocationFields } from './stripCityFromPlace.js'
import { cleanTitle } from './cleanTitle.js'
import { stripLinksFromHtml } from './cleanDescription.js'

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
  return `Current date (Israel, Asia/Jerusalem): ${year}-${month}-${day}. Use this to resolve relative dates (e.g. "השבוע", "מחר"). For ordinal+month and "5.6" format, use the specified year from context.
Output times as Israel local (YYYY-MM-DDTHH:mm, no Z) — we convert to UTC.`
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

const DETECTION_SYSTEM_PROMPT = `You are an assistant for a Hebrew community events calendar. Decide whether a WhatsApp message ANNOUNCES A SINGLE, REAL EVENT — one specific, concrete happening people could attend (e.g. a concert, show, party, workshop, lecture, tour, screening, fair, meetup, ceremony, festival).

To qualify, the message must actually DESCRIBE such a happening — convey WHAT it is, plus at least a hint of WHEN or WHERE. Judge the real content: the mere presence of the word "event"/"אירוע" does NOT make something an event.

isEvent = true (be inclusive — do not miss real events):
- A real single event even with partial details: a name/activity plus at least a day, time, or place. Missing exact time, price, or full address is fine.
- A SPECIFIC dated occurrence of a recurring activity (e.g. "this week's jam", "this month's fair", "tonight's ecstatic dance", "Friday's groove night") — it names a concrete date/day for THIS happening → true.
- One happening on a single date OR over consecutive days (a multi-day festival is ONE event), even if it lists an internal lineup/schedule of acts → true.

isEvent = false (only these — everything else leans true):
- Bare statement/label/meta-text that doesn't describe a real happening — "this is an event", "בדיקה", greetings, questions, opinions, a single word, random chatter. Also spam, ads, business info, menus/opening hours, items for sale, news, or a link with no event details.
- A RECURRING or ONGOING class/course with NO single dated occurrence — a weekly class, a "שיעורים"/"חוג" series, or a multi-session course sold as a package ("סדרת מפגשים", "X מפגשים", monthly subscription). BUT a ONE-TIME dated workshop / masterclass / single session IS an event → true.
- A message bundling MULTIPLE DISTINCT events — a season/program/festival-series teaser, or a schedule/memo listing several SEPARATE happenings (different activities and/or different dates). We can't store several events as one. (This is NOT the same as one event with an internal lineup, or a single multi-day festival — those are true.)

When genuinely unsure whether it's a real single event, lean toward TRUE — missing a real event is worse than letting a borderline one through. Return false ONLY when it clearly matches a reject case above.

Examples:
- "this is an event" / "זה אירוע" → false. "בדיקה" / "מה קורה היום?" → false.
- "הופעה של להקת X ביום שישי 20:00 בפאב Y" → true. "סדנת קדרות חד-פעמית, שישי 18.7 10:00" → true.
- "אקסטאטיק ראש פינה, חמישי 25.6 19:45" → true (a dated occurrence of a recurring dance).
- "פסטיבל ג'אז, 3 ימים 10-12.7" → true (one multi-day festival).
- "שיעורי היפהופ לנשים, מקומות אחרונים, להרשמה כתבו לי" → false (recurring class, no specific date).
- "קייצת שלאגר 2026 יוצאת לדרך, נרשמים כאן" → false (a whole season/program, not one event).
- "סדרת 5 מפגשים אומנותיים, המפגש הראשון 15.7" → false (a multi-session course).
- "השבוע: ראשון סדנה, שני הקרנה, רביעי הרצאה, שישי מסיבה" → false (several separate events in one message).

reason: null when isEvent is true; a short Hebrew reason when false.`

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

  // Retry transient failures (429/5xx + connection drops like "Premature close").
  // maxRetries:0 disables the SDK's own retry so this loop is the single source of
  // truth (predictable count + backoff + logging).
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const openai = createOpenAIClient({ apiKey, timeout: 15_000, maxRetries: 0 })
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
        log(correlationId, 'warn', 'detectEventFromFreeText: empty content', { attempt })
        return { isEvent: false, reason: 'לא התקבלה תשובה' }
      }
      const parsed = JSON.parse(content)
      const isEvent = parsed.isEvent === true
      const reason = parsed.reason != null ? String(parsed.reason).trim() || null : null
      log(correlationId, 'info', 'detectEventFromFreeText: ok', { isEvent, reason })
      return { isEvent, reason }
    } catch (err) {
      const retryable = isRetryableOpenAIError(err)
      const msg = err instanceof Error ? err.message : String(err)
      log(correlationId, 'error', 'detectEventFromFreeText failed', { attempt, retryable, detail: describeOpenAIError(err) })
      if (attempt < MAX_ATTEMPTS && retryable) {
        await sleep(getRetryDelayMs(err, attempt - 1))
        continue
      }
      // Surface `transient` so callers can distinguish a transport/API failure from
      // a genuine "not an event" verdict (e.g. to avoid recording it as processed).
      return { isEvent: false, reason: `שגיאה: ${msg}`, transient: retryable }
    }
  }
  return { isEvent: false, reason: 'שגיאה: retries exhausted', transient: true }
}

const FREE_LANG_FLAG_KEYS = ['rawOccurrences', 'rawPrice', 'rawLocation', 'rawMainCategory', 'rawCity', 'rawCityOutsideNorth', 'rawRegion']

/**
 * Build extraction schema with mainCategory and categories enum from valid category IDs.
 * @param {Array<{id: string, label: string}>} categoriesList
 * @returns {object} JSON schema for OpenAI response_format
 */
function buildExtractionSchema(categoriesList) {
  const validCategoryIds = Array.isArray(categoriesList)
    ? categoriesList.map((c) => c.id).filter((id) => typeof id === 'string' && id.trim())
    : []
  const mainCategorySchema = validCategoryIds.length > 0 ? { type: 'string', enum: validCategoryIds } : { type: 'string' }
  const categoriesItemsSchema = validCategoryIds.length > 0 ? { type: 'string', enum: validCategoryIds } : { type: 'string' }
  return {
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
        mainCategory: mainCategorySchema,
        categories: { type: 'array', items: categoriesItemsSchema, minItems: 0 },
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
}

const MAX_EXTRA_CATEGORIES = 3

function buildExtractionSystemPrompt(categoriesList, citiesList, dateContext, extraInstructions = '') {
  const categoriesText = categoriesList.map((c) => `- ${c.id}: ${c.label}`).join('\n')
  const citiesText = (citiesList || []).map((c) => c.title).join(', ')
  const extra = typeof extraInstructions === 'string' && extraInstructions.trim()
    ? `\n\n${extraInstructions.trim()}`
    : ''
  return `You extract event data from a single WhatsApp message (Hebrew community events calendar).

${dateContext}

CATEGORIES (you MUST use ONLY these ids — mainCategory + categories):
${categoriesText}

CITY: Extract the city/town name. Use standard spelling. If the message mentions a city from this list, use that exact name: ${citiesText}. Otherwise use the city name as stated. Fix obvious typos (e.g. קריעת שמונה → קריית שמונה).

NORTHERN ISRAEL ONLY: This calendar covers Northern Israel only (הגליל העליון, רמת הגולן, אצבע הגליל). Set city to empty string and add flag fieldKey="rawCityOutsideNorth", reason="העיר שזוהתה אינה באזור הצפון" ONLY when the message EXPLICITLY names a city/town/venue you are CERTAIN is in the south/center (e.g. תל אביב, ירושלים, באר שבע, נתניה, ראשון לציון, חיפה). Judge ONLY the actual event LOCATION. NEVER infer "outside the north" from: a theme/country/nationality (e.g. "מסיבת יום העצמאות של ארה״ב" — that's a theme, the party is here), a direction word ("לצפון", "בצפון"), a region adjective ("גלילית", "גלילי", "גולן"), or the mere ABSENCE of a recognizable city. If no city is stated, do NOT flag rawCityOutsideNorth — leave city empty and use the normal rawCity/rawLocation flags. When in any doubt, accept the city.

RULES:
1. rawTitle: The event's actual NAME — what the event IS — concise (about 2–7 words). Decide in this order:
   a. If the message has a clear, specific event name (a real title, not a slogan), USE IT, but CLEANED: drop dates, times, prices, the city/place, a leading call-to-action, emojis, and quotes/asterisks. Pull just the name out of its line — e.g. "פסטיבל היין של ראש פינה בסופש הקרוב!" → "פסטיבל היין של ראש פינה"; "🍷 הערב ביער מרפא דפנה! בואו לטעום יינות" → "טעימת יינות ביער מרפא דפנה".
   b. If the opening / most prominent line is a HYPE TAGLINE, slogan, teaser or call-to-action rather than a name (e.g. "האירוע המטורף של השנה", "אל תפספסו!", "וואלה התגעגענו!", "אתם מוכנים?!"), do NOT use it as the title. Instead SYNTHESIZE a short descriptive name from the actual content — the activity/type plus a defining detail (artist, theme, or venue): e.g. an Independence-Day party → "מסיבת יום העצמאות"; a foraging workshop with a guide → "סדנת ליקוט".
   Never output a generic slogan, a full sentence, a question, or marketing fluff as the title. Keep it factual — do NOT invent specifics (names, numbers) not in the message. The title must not contain dates, times, price, or emojis.
2. rawFullDescription: REWRITE the description into an appealing, easy-to-scan HTML block — this presentation rewrite is REQUIRED; do NOT just mirror the source's line breaks with <br>. Stay 100% faithful to the facts: never invent or change names, dates, prices, places or claims — formatting and emojis are decoration only.
   - Open with a punchy one-line hook in its own <p>, then short supporting <p> paragraphs.
   - When the text lists several activities / acts / offerings / items (even comma- or "ו"-separated, e.g. "דוכנים, אוכל ומוזיקה"), turn them into a <ul><li> list — one item per <li> — instead of a long sentence.
   - Use <strong> to highlight the KEY points that make the text clearer and more appealing — the headline act AND other genuinely important phrases (the main attractions, what's special), spread across the description, not only the opening hook. Bold short phrases (not single filler words), and don't over-bold — a few meaningful highlights, not every line. Never bold the date, price or location.
   - Use emojis with good taste to lift the appeal: if the source has NONE, add a few (about 2-4 across the description) that fit the vibe (🎶 🎤 🎸 🎨 🎭 🍷 🍝 🌿 🧘 🎉 👨‍👩‍👧‍👦 …); if it already has some, keep the fitting ones and add more only where it genuinely helps; if it's already emoji-heavy, trim to a tasteful amount. At most one per bullet / short paragraph. Don't repeat the same emoji, don't replace words with emojis, and skip emojis entirely for solemn events (e.g. memorials).
   - Allowed tags — ONLY these, nothing else (anything else is stripped): <p> <br> <strong> <em> <ul> <ol> <li>. No * or _, no headings, no <a>/<blockquote>/<code>/<s>. Min 70 chars.
   - LINKS & PHONES: NEVER leave a URL or phone number in the description — every link/phone goes to urls and must be removed from the body (including inside a <li>), along with the label/connector that only introduced it (e.g. "כרטיסים >> ", "טלפון להרשמה - ", "להזמנה: "). ALSO remove phrases that merely point at the link/registration without adding information (e.g. "כרטיסים בלינק", "כרטיסים למטה", "פרטים בקישור", "להרשמה בלינק", "לינק בתגובות") — the links are shown separately. Keep such a phrase only if it carries real info beyond "there is a link".
   - DATE/TIME: if the event has a SINGLE simple date/time, do NOT repeat it as a standalone headline line in the description (it's shown separately). KEEP timing in the description when it adds real info — multiple dates/occurrences, or a multi-step schedule (e.g. "פתיחת דלתות 19:30, מופע 20:30").
   - NOISE: drop standalone single-letter or punctuation-only lines (e.g. a lone "י"), decorative "#"/"*" markers around words, and repeated decorative separators.
   - TYPOS: fix only when 100% certain (e.g. "בילןי נחמד" → "בילוי נחמד"); never change wordplay, puns or intentional phrasing.
3. shortDescription: 1-2 short Hebrew sentences on what the event is and its vibe. You MAY include one enticing highlight (e.g. "כניסה חופשית" or the venue) when it adds appeal. Keep it short and engaging — don't just restate the full date/time.
4. rawOccurrences: String representation of dates/times from message. rawOccurrences must capture BOTH date AND time from the ENTIRE message. Date and time often appear in different places (e.g. date in header "28.2.26", times later "18:00", "18:30"). Scan the full message: extract the calendar date from one part, extract the start time from another, and synthesize rawOccurrences as a combined string (e.g. "28.2.26 18:00" or "28.2 במוצ״ש 18:00"). Do NOT output only the date when times exist elsewhere.
5. occurrences: ${OCCURRENCE_RULES}
When date and time appear in different parts of the message (e.g. date in header "28.2.26", time "18:00" in body), combine them into one startTime. When multiple times appear for the same date (e.g. "12:00 - פתיחה, 13:00 - הופעה"), infer the correct startTime from what the event is advertising: if the whole day/event is advertised, use the first stated time; if the event is specifically the show, use that time. Example: event with 18:00 (פתיחת מרחב), 18:30 (חימום), 18:45–21:00 (מסע) — the event starts at 18:00. No single clear end → endTime: null.
6. rawPrice: String from message (e.g. "50" or "חינם"). price: number or 0 (free) or null. When the text implies no entrance fee (e.g. חינם, בחינם, חופשי, כניסה חופשית, ללא תשלום, ללא דמי כניסה, אין דמי כניסה, or any phrasing that clearly indicates free/no charge) → price: 0. Do NOT rely only on examples — infer from meaning. Use the MAIN/STANDARD price only — NOT last-minute or day-of price (e.g. "50 ש״ח עד למועד האירוע, 60 ש״ח ביום האירוע" → use 50), NOT bundle price (e.g. "100 ש״ח לכרטיס, 180 ש״ח לשני כרטיסים" → use 100). Prefer the single-ticket or advance price when multiple options exist.
7. mainCategory/categories: ALWAYS infer from content (event type, topic, keywords). mainCategory = primary best-fit. Then WORK HARD to find secondary categories — a secondary category is the NORM, not the exception. Scan the whole category list and add every other id whose theme is present, judged by the event's SUBJECT/TOPIC, its AUDIENCE, and its ACTIVITIES (not only its format). A lecture/talk/הרצאה MUST also carry its subject as a category (about art → [lecture, art]; about technology or AI → [lecture, technology]; about health → [lecture, health]; about nature → [lecture, nature]). Likewise: "מתאים לילדים"/"משפחות" → add kids; a guided or hands-on session → add workshop; food or drink as a focus → add food; time in nature → add nature; live music → add music. categories = [mainCategory] + up to ${MAX_EXTRA_CATEGORIES} additional ids; aim for 2 on most events. Return only mainCategory when, after this scan, genuinely no second theme exists (e.g. a plain pickup football game → sport alone), and never add an id that truly does not fit. LIVE MUSIC: when the event's main draw is a live musical performance/concert, set mainCategory = "show" AND include "music" — this is for concerts/gigs/live performances only, NOT DJ/dance parties (use "party"), NOT jam sessions (use "jam"), NOT music workshops/courses (use "workshop"/"course"). Only flag rawMainCategory when you truly cannot infer any suitable category (e.g. completely generic "אירוע" with zero context).
8. location: Extract locationName, addressLine1, addressLine2, wazeNavLink, gmapsNavLink. rawLocationName/rawAddressLine1 = raw strings. IMPORTANT: Do NOT repeat the city name in locationName or addressLine1 — City is stored separately. locationName = venue/place name only (e.g. "מרכז קהילתי", "פאב השכונה"); addressLine1 = street/address or specific detail (e.g. "רחוב הרצל 5"), NOT the city. If the only location info is the city, leave locationName and addressLine1 empty.
9. urls: Event links and phones only. type=link|phone. Title = a meaningful Hebrew label describing the destination, inferred from context (e.g. "כרטיסים", "הרשמה", "אתר האירוע", "טלפון להרשמה", "וואטסאפ"). NEVER use "כאן"/"לינק"/"here"/"click"/punctuation as the Title. For phones: Url = digits only. Exclude Waze/Gmaps (those go to rawNavLinks).
10. rawNavLinks: Newline-separated Waze and Google Maps URLs if present. Else "".
11. rawUrls: Newline-separated other URLs and phone numbers. Else "".

FLAGS: Add to flags ONLY when UNABLE to extract OR when you are CERTAIN the city is outside Northern Israel (per rule above — when in doubt, do not flag rawCityOutsideNorth). Flag rawOccurrences ONLY when no date/time at all. NEVER flag for missing end time — end time is optional. If you output occurrences with date and startTime, do NOT add rawOccurrences to flags. Flag rawPrice ONLY when you truly cannot conclude (neither price nor any implication of free). If the text implies no charge, output price: 0 and do NOT flag. Flag rawLocation ONLY when BOTH locationName AND city are empty (we need at least one). Flag rawCity when city could not be extracted but locationName exists (user can provide city or skip to go to region). Do NOT flag rawLocation when we have city (city only is valid). Do NOT flag rawCity when both are missing (rawLocation compound will collect city). Flag rawMainCategory ONLY when category truly cannot be inferred from content.
Include ALL qualifying flags. reason = short Hebrew explanation.${extra}`
}

/**
 * Extract structured event data from free-language message.
 * Returns rawEventSupplement (for buildRawEvent), formattedEvent (for preview), and flags.
 * @param {string} text - Raw user message
 * @param {Array<{id: string, label: string}>} categoriesList
 * @param {Array<{id: string, title: string, region: string}>} citiesList
 * @param {{ openaiApiKey?: string, openaiModel?: string, correlationId?: string, extraInstructions?: string }} [options]
 *   extraInstructions: optional caller-supplied text appended verbatim to the end of the system
 *   prompt (e.g. consumer-specific description-style / category rules). Defaults to none, so callers
 *   that omit it get the exact base prompt — keeping behavior unchanged.
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
  const systemPrompt = buildExtractionSystemPrompt(categoriesList, citiesList || [], dateContext, options.extraInstructions || '')

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const openai = createOpenAIClient({ apiKey, timeout: 60_000, maxRetries: 0 })
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract event from this message (HTML below):\n\n${messageHtml || userContent}` },
        ],
        response_format: { type: 'json_schema', json_schema: buildExtractionSchema(categoriesList) },
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
      const cleanedTitle = cleanTitle(parsed.rawTitle) // strip trailing date/time/decoration deterministically
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
        rawTitle: cleanedTitle,
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
      // Deterministic safety net: guarantee no raw URL survives in the body (the prompt asks for
      // this, but the model occasionally leaves one — especially when reformatting into a list).
      const fullDescriptionValue = stripLinksFromHtml(rawDesc
        ? (looksLikeHtml ? rawDesc : convertMessageToHtml(rawDesc))
        : '')
      const rawOccurrences = Array.isArray(parsed.occurrences) && parsed.occurrences.length > 0 ? parsed.occurrences : []
      const rawOccurrencesStr = (parsed.rawOccurrences ?? '').trim() || undefined
      const normalizedOccurrences = normalizeFormattedEventOccurrences(rawOccurrences, rawOccurrencesStr)
      const formattedEvent = {
        Title: cleanedTitle || 'אירוע',
        shortDescription: (parsed.shortDescription ?? '').trim() || 'אירוע',
        fullDescription: fullDescriptionValue,
        mainCategory,
        categories,
        location,
        occurrences: normalizedOccurrences,
        price: parsed.price,
        urls: Array.isArray(parsed.urls)
          ? parsed.urls.filter((u) => u?.Title && u?.Url).map((u) => ({ Title: u.Title, Url: u.Url, type: u.type === 'phone' ? 'phone' : 'link' }))
          : [],
        media: [],
      }

      let flags = Array.isArray(parsed.flags)
        ? parsed.flags
            .filter((f) => f && FREE_LANG_FLAG_KEYS.includes(f.fieldKey) && typeof f.reason === 'string' && f.reason.trim())
            .map((f) => ({ fieldKey: f.fieldKey, reason: f.reason.trim() }))
        : []

      // Post-process: drop rawOccurrences flag when we have valid occurrences and the flag is only about missing end time (which is optional)
      const hasValidOccurrences = Array.isArray(parsed.occurrences) && parsed.occurrences.length > 0 && parsed.occurrences.some((o) => o?.date && (o?.startTime || !o?.hasTime))
      const endTimeFlagPhrases = ['שעה סופית', 'שעת סיום', 'שעה סיום', 'end time']
      flags = flags.filter((f) => {
        if (f.fieldKey !== 'rawOccurrences') return true
        if (!hasValidOccurrences) return true
        const r = (f.reason || '').toLowerCase()
        const isEndTimeOnly = endTimeFlagPhrases.some((phrase) => r.includes(phrase.toLowerCase()))
        return !isEndTimeOnly
      })

      // Post-process location/city flags by scenario
      const hasLocationName = !!(strippedLocationName && strippedLocationName.trim())
      const hasCity = !!(locCity && locCity.trim())
      if (!hasRawCityOutsideNorth) {
        if (hasLocationName && !hasCity) {
          // Scenario 1: location only -> rawRegion only (ask region)
          flags = flags.filter((f) => f.fieldKey !== 'rawLocation')
          if (!flags.some((f) => f.fieldKey === 'rawRegion')) {
            flags.push({ fieldKey: 'rawRegion', reason: 'נדרש לאזור כאשר יש מקום ללא יישוב' })
          }
        } else if (hasCity && !hasLocationName) {
          // Scenario 2: city only -> rawRegion if custom city
          flags = flags.filter((f) => f.fieldKey !== 'rawLocation')
          if (rawCityType === 'custom' && !flags.some((f) => f.fieldKey === 'rawRegion')) {
            flags.push({ fieldKey: 'rawRegion', reason: 'נדרש לאזור כאשר היישוב לא ברשימה' })
          }
        } else if (!hasLocationName && !hasCity) {
          // Scenario 3: both missing -> rawLocation only (compound collects place + city)
          flags = flags.filter((f) => f.fieldKey !== 'rawCity')
          if (!flags.some((f) => f.fieldKey === 'rawLocation')) {
            flags.push({ fieldKey: 'rawLocation', reason: 'מיקום ויישוב חסרים' })
          }
        }
      }

      log(correlationId, 'info', 'extractEventFromFreeText: ok', {
        title: formattedEvent.Title,
        flagsCount: flags.length,
        ...(flags.length > 0 && {
          flags: flags.map((f) => ({ fieldKey: f.fieldKey, reason: f.reason })),
          rawOccurrences: rawEventSupplement?.rawOccurrences ?? '(none)',
          occurrencesFromAI: parsed.occurrences?.map((o) => ({ date: o.date, hasTime: o.hasTime, startTime: o.startTime?.slice(0, 19), endTime: o.endTime?.slice(0, 19) ?? null })),
          rawPrice: rawEventSupplement?.rawPrice ?? '(none)',
          priceFromAI: parsed.price ?? null,
        }),
      })
      return { rawEventSupplement, formattedEvent, flags }
    } catch (err) {
      const retryable = isRetryableOpenAIError(err)
      const msg = err instanceof Error ? err.message : String(err)
      log(correlationId, 'error', 'extractEventFromFreeText failed', { attempt, retryable, detail: describeOpenAIError(err) })
      if (attempt < MAX_ATTEMPTS && retryable) {
        await sleep(getRetryDelayMs(err, attempt - 1))
        continue
      }
      // `transient` lets callers tell a transport/API failure (safe to retry later)
      // from a deterministic failure, so a blip isn't recorded as a final verdict.
      return { rawEventSupplement: null, formattedEvent: null, flags: [], errorReason: `openai_error: ${msg}`, transient: retryable }
    }
  }
  return { rawEventSupplement: null, formattedEvent: null, flags: [], errorReason: 'openai_no_result', transient: true }
}

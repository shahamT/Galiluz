import { PUBLISHER_EVENT_FORMAT_SCHEMA } from '~/server/consts/publisherEventFormatSchema'
import { getOpenAIClient } from '~/server/utils/openai'
import { validatePublisherFormattedEvent } from '~/server/utils/eventValidation'

const DEFAULT_MODEL = 'gpt-4o-mini'
const MAX_ATTEMPTS = 3
/** Cap total user message length to avoid token limits and slow requests. */
const MAX_USER_CONTENT_CHARS = 16_000
const LOG_PREFIX = '[EventsAPI] Publisher format'

export interface FormatPublisherEventOptions {
  /** Correlation id from the create handler for tracing logs. */
  correlationId?: string
}

function log(ctx: string | undefined, level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  const parts = [LOG_PREFIX]
  if (ctx) parts.push(ctx)
  parts.push(message)
  if (data && Object.keys(data).length > 0) parts.push(JSON.stringify(data))
  const line = parts.join(' ')
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}

interface PublisherInfo {
  phone?: string
  name?: string
  waId: string
}

interface RawEventWithAll {
  title?: string
  description?: string
  placeName?: string
  city?: string
  addressLine1?: string
  addressLine2?: string
  locationNotes?: string
  wazeNavLink?: string
  gmapsNavLink?: string
  dateTimeRaw?: string
  price?: string
  publisher?: PublisherInfo
  mainCategory?: string
  categories?: string[]
  media?: unknown[]
  [key: string]: unknown
}

interface CategoryItem {
  id: string
  label: string
}

interface AIFormatResult {
  shortDescription: string
  categories: string[]
  occurrences: Array<{
    date: string
    hasTime: boolean
    startTime: string
    endTime: string | null
  }>
  city: string
  price: number | null
}

/** Backend event shape: Title, location.City, etc. (compatible with eventsTransform) */
export interface FormattedPublisherEvent {
  Title: string
  shortDescription: string
  fullDescription: string
  mainCategory: string
  categories: string[]
  location: {
    City: string
    locationName?: string
    addressLine1?: string | null
    addressLine2?: string | null
    locationDetails?: string | null
    wazeNavLink?: string | null
    gmapsNavLink?: string | null
  }
  occurrences: Array<{
    date: string
    hasTime: boolean
    startTime: string
    endTime: string | null
  }>
  price: number | null
  media: unknown[]
  urls: Array<{ Title: string; Url: string }>
  publisherPhone?: string
  publisherName?: string
}

function getIsraelDateContext(): string {
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
  return `Current date (Israel, Asia/Jerusalem): ${year}-${month}-${day}. Use this to resolve relative dates in dateTimeRaw.`
}

function buildSystemPrompt(categoriesList: CategoryItem[]): string {
  const categoriesText = categoriesList.map((c) => `- ${c.id}: ${c.label}`).join('\n')
  return `You are a formatting assistant for publisher-submitted event data (Hebrew community events calendar). The input is structured data that the publisher already provided via a form — NOT a random WhatsApp message. Your job is to format and validate only; do NOT infer or add information the publisher did not provide.

RULES:
1. Use the full raw event object only as context. Output only the fields defined in the schema.
2. dateTimeRaw: Parse into occurrences. All times are Israel (Asia/Jerusalem). Each occurrence: date = YYYY-MM-DD (Israel), hasTime = true if a specific time was given else false, startTime = ISO 8601 UTC string (if hasTime: combine date with time in Israel then convert to UTC; if !hasTime: use Israel midnight for that date in UTC), endTime = ISO UTC or null if not given.
3. city: The publisher already provided a city. Only fix obvious typos or normalize the name (e.g. "חיפה" stay as is). Do not change or infer a different city.
4. price: Convert to number or null. Free / "חינם" / 0 → 0. If unclear or not a single number, use null.
5. shortDescription: Write a brief summary (1–2 sentences) based only on the provided description. Do not add details that are not in the description.
6. categories: mainCategory is already provided in the raw event — it MUST be included in the categories array. Add up to 3 additional category ids ONLY from the list below when the event clearly fits (e.g. both music and party). Do not add categories the publisher did not intend. Use ONLY these ids:

${categoriesText}`
}

/** Build a lean payload for OpenAI: strip large media payloads to avoid token limits. */
function buildLeanPayloadForPrompt(raw: RawEventWithAll): Record<string, unknown> {
  const media = Array.isArray(raw.media)
    ? raw.media.map((m: unknown) => {
        const item = m as Record<string, unknown>
        return {
          cloudinaryURL: item?.cloudinaryURL ?? '',
          isMain: item?.isMain ?? false,
        }
      })
    : []
  return {
    ...raw,
    media,
  }
}

function isRetryableOpenAIError(err: unknown): boolean {
  const status = (err as { status?: number })?.status
  if (status === 429) return true
  if (status === 408) return true
  if (typeof status === 'number' && status >= 500) return true
  return false
}

function getRetryDelayMs(err: unknown, attemptIndex: number): number {
  const status = (err as { status?: number })?.status
  const message = (err as { message?: string })?.message
  if (status === 429 && message) {
    const match = String(message).match(/try again in (\d+)ms/i)
    if (match) {
      return Math.min(60_000, Math.max(500, Number(match[1])))
    }
    return 2000
  }
  const backoff = 1000 * 2 ** attemptIndex
  return Math.min(30_000, backoff)
}

function isValidAIResult(parsed: unknown): parsed is AIFormatResult {
  if (!parsed || typeof parsed !== 'object') return false
  const p = parsed as Record<string, unknown>
  if (typeof p.shortDescription !== 'string') return false
  if (!Array.isArray(p.categories) || p.categories.length === 0) return false
  if (!Array.isArray(p.occurrences) || p.occurrences.length === 0) return false
  if (typeof p.city !== 'string') return false
  if (p.price !== null && (typeof p.price !== 'number' || !Number.isFinite(p.price))) return false
  return true
}

/**
 * Call OpenAI to format publisher raw event into the schema fields only.
 * Returns parsed AI result or null on failure.
 */
async function callOpenAIForPublisherFormat(
  rawEventWithAll: RawEventWithAll,
  categoriesList: CategoryItem[],
  dateContext: string,
  correlationId?: string,
): Promise<AIFormatResult | null> {
  const openai = getOpenAIClient()
  if (!openai) {
    log(correlationId, 'warn', 'skipped: no OpenAI API key', { reason: 'no_openai_key' })
    return null
  }

  const config = useRuntimeConfig()
  const model = (config.openaiModel as string) || DEFAULT_MODEL
  const inputSummary = {
    titleLength: typeof rawEventWithAll.title === 'string' ? rawEventWithAll.title.trim().length : 0,
    dateTimeRawLength: typeof rawEventWithAll.dateTimeRaw === 'string' ? rawEventWithAll.dateTimeRaw.trim().length : 0,
    mainCategory: rawEventWithAll.mainCategory ?? '(empty)',
    cityFromRaw: typeof rawEventWithAll.city === 'string' ? rawEventWithAll.city : '(empty)',
  }

  const systemPrompt = buildSystemPrompt(categoriesList)
  const leanPayload = buildLeanPayloadForPrompt(rawEventWithAll)
  let userContent = `${dateContext}\n\nFull raw event (publisher-submitted) — use as context:\n${JSON.stringify(leanPayload, null, 2)}`
  const truncated = userContent.length > MAX_USER_CONTENT_CHARS
  if (truncated) {
    userContent = userContent.slice(0, MAX_USER_CONTENT_CHARS) + '\n\n[... truncated for length]'
  }

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
        } as const,
        max_tokens: 2000,
        temperature: 0.1,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        log(correlationId, 'warn', 'OpenAI returned empty content', { attempt })
        return null
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(content)
      } catch {
        log(correlationId, 'error', 'invalid JSON in response', { attempt, contentLength: content.length })
        return null
      }
      if (isValidAIResult(parsed)) {
        log(correlationId, 'info', 'OpenAI response valid', {
          occurrencesCount: parsed.occurrences.length,
          city: parsed.city,
          price: parsed.price,
          categoriesCount: parsed.categories.length,
        })
        return parsed
      }
      log(correlationId, 'error', 'response shape invalid', {
        attempt,
        hasShortDescription: typeof (parsed as Record<string, unknown>).shortDescription === 'string',
        hasCategories: Array.isArray((parsed as Record<string, unknown>).categories),
        hasOccurrences: Array.isArray((parsed as Record<string, unknown>).occurrences),
        hasCity: typeof (parsed as Record<string, unknown>).city === 'string',
        priceType: typeof (parsed as Record<string, unknown>).price,
      })
      return null
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const status = (err as { status?: number })?.status
      log(correlationId, 'error', 'OpenAI request failed', { attempt, error: msg, status, retryable: isRetryableOpenAIError(err) })
      if (attempt < MAX_ATTEMPTS && isRetryableOpenAIError(err)) {
        const delay = getRetryDelayMs(err, attempt - 1)
        log(correlationId, 'info', `retrying in ${delay}ms`, { attempt, nextAttempt: attempt + 1 })
        await new Promise((r) => setTimeout(r, delay))
      } else {
        return null
      }
    }
  }
  return null
}

/**
 * Format a publisher raw event (wa-bot flow) into a full event object using OpenAI.
 * Pass-through fields are copied from rawEventWithAll; AI returns shortDescription, categories, occurrences, city, price.
 * Returns the formatted event (backend shape) or null on failure.
 */
export async function formatPublisherEvent(
  rawEventWithAll: RawEventWithAll,
  categoriesList: CategoryItem[],
  options?: FormatPublisherEventOptions,
): Promise<FormattedPublisherEvent | null> {
  const correlationId = options?.correlationId

  if (!categoriesList.length) {
    log(correlationId, 'error', 'skipped: categories list is empty', { reason: 'empty_categories_list' })
    return null
  }

  const dateContext = getIsraelDateContext()
  const aiResult = await callOpenAIForPublisherFormat(rawEventWithAll, categoriesList, dateContext, correlationId)
  if (!aiResult) return null

  const publisher = rawEventWithAll.publisher
  const title = typeof rawEventWithAll.title === 'string' ? rawEventWithAll.title.trim() : ''
  const fullDescription = typeof rawEventWithAll.description === 'string' ? rawEventWithAll.description : ''

  const event: FormattedPublisherEvent = {
    Title: title || 'אירוע',
    shortDescription: typeof aiResult.shortDescription === 'string' ? aiResult.shortDescription : '',
    fullDescription,
    mainCategory: rawEventWithAll.mainCategory || aiResult.categories[0] || 'community_meetup',
    categories: Array.isArray(aiResult.categories) && aiResult.categories.length > 0 ? aiResult.categories : [rawEventWithAll.mainCategory || 'community_meetup'],
    location: {
      City: aiResult.city ?? rawEventWithAll.city ?? '',
      locationName: typeof rawEventWithAll.placeName === 'string' && rawEventWithAll.placeName.trim() ? rawEventWithAll.placeName.trim() : undefined,
      addressLine1: rawEventWithAll.addressLine1 ?? null,
      addressLine2: rawEventWithAll.addressLine2 ?? null,
      locationDetails: rawEventWithAll.locationNotes ?? null,
      wazeNavLink: rawEventWithAll.wazeNavLink ?? null,
      gmapsNavLink: rawEventWithAll.gmapsNavLink ?? null,
    },
    occurrences: aiResult.occurrences,
    price: aiResult.price,
    media: Array.isArray(rawEventWithAll.media) ? rawEventWithAll.media : [],
    urls: [],
    publisherPhone: typeof publisher?.phone === 'string' ? publisher.phone : undefined,
    publisherName: typeof publisher?.name === 'string' ? publisher.name : undefined,
  }

  if (!event.categories.includes(event.mainCategory)) {
    event.categories = [event.mainCategory, ...event.categories.filter((c) => c !== event.mainCategory)]
  }

  const validation = validatePublisherFormattedEvent(event)
  if (!validation.valid) {
    log(correlationId, 'error', 'validation failed', { reason: validation.reason, title: event.Title?.slice(0, 50), occurrencesCount: event.occurrences?.length })
    return null
  }

  log(correlationId, 'info', 'format complete', {
    occurrencesCount: event.occurrences.length,
    city: event.location.City,
    mainCategory: event.mainCategory,
    price: event.price,
  })
  return event
}

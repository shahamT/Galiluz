import { openai } from './openai.service.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'
import { incrementOpenAICalls } from './usageTracking.service.js'
import { OPENAI } from '../consts/index.js'
import { getDateTimeContext, isImageUrl } from '../consts/events.const.js'
import {
  CLASSIFICATION_SCHEMA,
  EXTRACTION_SCHEMA,
  COMPARISON_SCHEMA,
  EVIDENCE_LOCATOR_SCHEMA,
  DESCRIPTION_BUILDER_SCHEMA,
  FIELD_VERIFICATION_SCHEMA,
} from '../consts/openaiSchemas.const.js'
import { convertMessageToHtml } from '../utils/whatsappFormatToHtml.js'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableOpenAIError(error) {
  const status = error?.status
  if (status === 429) return true
  if (status >= 500) return true
  if (status === 408) return true
  return false
}

/**
 * Extract status, code, message from OpenAI API error for consistent logging.
 * @param {*} error
 * @returns {{ status?: number, code?: string, message: string }}
 */
function formatOpenAIErrorForLog(error) {
  const message = error instanceof Error ? error.message : String(error ?? 'unknown')
  return {
    ...(error?.status != null && { status: error.status }),
    ...(error?.code != null && { code: error.code }),
    message,
  }
}

/**
 * @param {*} error - OpenAI API error (may have status and message)
 * @param {number} attemptIndex - 0 before first retry, 1 before second retry
 * @returns {number} delay in ms
 */
function getRetryDelayMs(error, attemptIndex) {
  if (error?.status === 429 && error?.message) {
    const match = String(error.message).match(/try again in (\d+)ms/i)
    if (match) {
      const ms = Math.min(60000, Math.max(500, Number(match[1])))
      return ms
    }
    return 2000
  }
  const backoff = 1000 * Math.pow(2, attemptIndex)
  return Math.min(30000, backoff)
}

export function extractUrlsFromText(text) {
  if (!text) return []
  const urlRegex = /https?:\/\/[^\s]+/g
  return [...new Set(text.match(urlRegex) || [])]
}

/** Max length for message text passed to OpenAI to limit prompt size and abuse. */
const MESSAGE_TEXT_MAX_LENGTH = 8000

/** Leading-line patterns that may indicate prompt-injection (English override attempts). Stripped only at start of message. */
const LEADING_OVERRIDE_PATTERN = /^\s*(system\s*:|\s*ignore\s+(all\s+)?(previous|above|prior)\s+instructions?|\s*disregard\s+(all\s+)?(previous|above)\s*|\s*you\s+are\s+now\s+)/im

/**
 * Sanitize message text before using in OpenAI prompts: truncate length and strip leading instruction-override attempts.
 * Does not alter normal Hebrew or event content.
 * @param {string} text - Raw message text
 * @returns {string}
 */
export function sanitizeMessageForPrompt(text) {
  if (!text || typeof text !== 'string') return ''
  let s = text.trim()
  const firstLineMatch = s.match(LEADING_OVERRIDE_PATTERN)
  if (firstLineMatch) {
    const firstLineEnd = s.indexOf('\n', firstLineMatch.index)
    const stripEnd = firstLineEnd === -1 ? s.length : firstLineEnd
    s = s.slice(stripEnd).trim()
  }
  if (s.length > MESSAGE_TEXT_MAX_LENGTH) {
    s = s.slice(0, MESSAGE_TEXT_MAX_LENGTH)
  }
  return s
}

export async function callOpenAIForClassification(messageText, cloudinaryUrl) {
  messageText = sanitizeMessageForPrompt(messageText || '')
  const dateCtx = getDateTimeContext()
  const hasImage = isImageUrl(cloudinaryUrl)

  const systemPrompt = `You are a message classification assistant for a Hebrew community events calendar.
Determine if a WhatsApp message describes a SPECIFIC event and extract search key phrases.

${dateCtx}

RULES:
1. An event MUST have a SPECIFIC calendar date (day+month or full date, e.g. 19.2, 25/02). Reject relative-only dates: "היום", "מחר", "בשבוע הבא", etc. Reject recurring-only schedules: when the only date info is weekdays (e.g. "ימי ראשון", "ימי שני", "כל יום שני") with no specific calendar date, set isEvent to false (e.g. reason: "recurring_schedule_no_specific_date").
2. An event MUST describe a specific gathering, activity, or happening — not business hours, menus, or ads.
3. If the message text has no date, and an image is provided, check the image for dates. If still none, reject.
4. The message must describe ONE specific event. If it describes more than one distinct event (e.g. a listing or roundup with several events, each with its own date, venue, or name), set isEvent to false and reason to "multiple_events". We only process single-event messages.
5. Extract 3-5 Hebrew search key phrases (location, event type, date references, venue names).

EXAMPLE:
Message: "הופעה של עידן רייכל ב-25 לפברואר בהיכל התרבות חיפה, כרטיסים מ-120 ₪"
→ { "isEvent": true, "searchKeys": ["עידן רייכל", "היכל התרבות", "חיפה", "הופעה", "פברואר"], "reason": null }

Message: "שעות פתיחה: א-ה 9:00-17:00"
→ { "isEvent": false, "searchKeys": [], "reason": "business_hours_no_specific_date" }

Message with "19.2 | Event A | Venue 1" and "20-21.2 | Event B | Venue 2" (two or more distinct events)
→ { "isEvent": false, "searchKeys": [], "reason": "multiple_events" }

Message with only "היום ב7 בערב" (today at 7 PM) and no calendar date
→ { "isEvent": false, "searchKeys": [], "reason": "relative_date_no_calendar" }

Message with only "ימי ראשון ... ימי שני" (Sundays ... Mondays) and no specific calendar date
→ { "isEvent": false, "searchKeys": [], "reason": "recurring_schedule_no_specific_date" }`

  let userContent
  if (hasImage) {
    userContent = [
      { type: 'text', text: `Classify this WhatsApp message:\n\n${messageText || '(no text – check the image)'}` },
      { type: 'image_url', image_url: { url: cloudinaryUrl } },
    ]
  } else {
    userContent = `Classify this WhatsApp message:\n\n${messageText || '(empty)'}`
  }

  const maxAttempts = OPENAI.MAX_ATTEMPTS
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_schema', json_schema: CLASSIFICATION_SCHEMA },
        max_tokens: 400,
        temperature: 0.1,
      })

      const content = response.choices[0]?.message?.content
      if (!content) return null

      let result
      try {
        result = JSON.parse(content)
      } catch (parseErr) {
        const parseMsg = parseErr instanceof Error ? parseErr.message : String(parseErr)
        logger.error(LOG_PREFIXES.EVENT_SERVICE, 'Classification invalid JSON response', { message: parseMsg, contentLength: content.length })
        return null
      }
      await incrementOpenAICalls()
      return {
        isEvent: result.isEvent,
        searchKeys: result.searchKeys || [],
        reason: result.reason || null,
      }
    } catch (error) {
      const errLog = formatOpenAIErrorForLog(error)
      logger.error(LOG_PREFIXES.EVENT_SERVICE, `Classification API error (attempt ${attempt}/${maxAttempts})`, errLog)
      if (attempt < maxAttempts && isRetryableOpenAIError(error)) {
        const delay = getRetryDelayMs(error, attempt - 1)
        logger.info(LOG_PREFIXES.EVENT_SERVICE, `OpenAI retrying in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`, errLog)
        await sleep(delay)
      } else {
        logger.warn(LOG_PREFIXES.EVENT_SERVICE, 'Classification failed after max attempts', { attempts: maxAttempts, ...errLog })
        return null
      }
    }
  }
  logger.warn(LOG_PREFIXES.EVENT_SERVICE, 'Classification failed after all retries', { attempts: maxAttempts })
  return null
}

export async function callOpenAIForExtraction(messageText, cloudinaryUrl, categoriesList) {
  messageText = sanitizeMessageForPrompt(messageText || '')
  const dateCtx = getDateTimeContext()
  const hasImage = isImageUrl(cloudinaryUrl)
  const categoriesText = categoriesList.map(c => `- ${c.id}: ${c.label}`).join('\n')
  const allUrls = extractUrlsFromText(messageText)
  const messageBodyHtml = convertMessageToHtml(messageText)

  const systemPrompt = `You are an event extraction assistant for a Hebrew community calendar.
Extract structured event data from a WhatsApp message. Return ONLY data that is EXPLICITLY stated in the message or image — never guess or infer.

${dateCtx}

TIMEZONE RULE (CRITICAL):
All times in messages are in Israel local time (${dateCtx.includes('UTC+3') ? 'UTC+3' : 'UTC+2'}).
You MUST convert them to UTC before putting them in startTime / endTime. For each entry in occurrences, never put the local hour unchanged into the UTC string — subtract the offset.
Examples: message "20:00" Israel, offset UTC+2 → startTime "…T18:00:00.000Z". Message "17:30" Israel, offset UTC+2 → startTime "…T15:30:00.000Z".
If the message mentions multiple times (e.g. activity at 17:30, lecture at 18:30), use the time when the main event actually starts. Interpret Hebrew like "8 בערב" as 20:00 Israel local, then convert that to UTC for startTime.

ALL-DAY RULE (date but no time):
If the message has a calendar DATE but NO explicit time (e.g. "יום שישי 7.3 פיקניק"), set hasTime to false for that occurrence.
Then set startTime to that date at Israel local 00:00 (midnight) converted to UTC (e.g. for 2026-03-07 with UTC+2 → "2026-03-06T22:00:00.000Z"), and endTime to null.

OCCURRENCES (REQUIRED):
- occurrences: An array of one or more occurrence objects. Each object has date, hasTime, startTime, endTime.
- Single-day event: Return exactly one object in occurrences, e.g. [{ "date": "2026-02-25", "hasTime": true, "startTime": "2026-02-25T18:00:00.000Z", "endTime": null }].
- Multi-day event (e.g. "7–9 במרץ", "שישי-שבת 7-8.3", "פסטיבל 20–22.2"): Return one object per calendar day. Each object has that day's date (YYYY-MM-DD Israel), and the same hasTime/startTime/endTime rules. If the event is all-day on each day, use that date at Israel midnight → UTC for startTime and endTime null for each. If specific times are stated per day, set each occurrence accordingly.

ALLOWED CATEGORIES:
${categoriesText}

CATEGORIES RULE (REQUIRED):
- categories and mainCategory MUST use only the exact category ids from the list above (e.g. party, music, workshop). Never use the label text or invent new ids.
- You MUST assign at least one category that fits the event. If the event clearly fits one of the listed types, choose the best-matching id.
- Mapping examples (use these ids): dance / ריקוד / אקסטטיק דאנס / מסיבה → party; תנועה / ספורט → sport; מוזיקה / הופעה → music or show; סדנה / סדנא → workshop; מפגש קהילתי → community_meetup; טיול / טבע → nature; הרצאה → lecture. When in doubt between two, pick the best fit and include it.

FIELD RULES:
The message body you receive is in HTML format. For Title, shortDescription, location, price, dates, and all other fields: extract from the text content; ignore HTML tags.

ACCURACY (date, location, price, time): Use only information explicitly stated in the message or clearly readable in the image. Do not infer or guess. If not clearly stated or readable, set the field to null (or empty string for location.City). When the date appears only in the image (e.g. "17/2", "יום שלישי 17/2"), use that date for each occurrence's date and startTime and cite the image in justifications. For each entry in occurrences: date is YYYY-MM-DD (Israel); startTime is built from that date plus time (Israel) converted to UTC.

- Title: Event name ONLY. No price. No date or time or when — strip from the title: מחר, בשבוע הבא, day names (e.g. יום שלישי), numeric dates (e.g. 17/2), times (e.g. בשעה 20:00). Location is allowed only when the advertiser presents it as part of the event name (e.g. "פסטיבל הגולן", "חן מזרחי מגיע לצפון הגולן"); do not add location if it appears only as a separate detail (e.g. "בחיפה" in another sentence).
- shortDescription: What the event is about. No price, no date, no location.
- fullDescription: When relevant, preserve the provided HTML if it supprts the readability and clarity of info. Use only these tags: <p>, <br>, <strong>, <em>, <del>, <code>, <pre>, <blockquote>, <ul>, <ol>, <li>. No other tags (no div, span, a, script, etc.). Do not re-interpret or strip formatting; keep the structure. You may fix obvious typos (e.g. "הרצאטבע" → "הרצאת טבע"). ALWAYS REMOVE from fullDescription: (1) Every raw URL (they go in urls). (2) The label/title text for each extracted link when it appears attached to that link in the message — for each entry in urls, remove both the URL and the phrase you used as that entry's Title when they appear together (e.g. "כרטיסים אחרונים" next to the URL); remove any arrow/symbol that only links them. The link and its title live in urls only; do not duplicate them in fullDescription. KEEP in fullDescription: Generic phrases that do not repeat a specific link or its title (e.g. "כרטיסים למטה בלינק", "בקישור המצורף", "כרטיסים והרשמה - בקישור המצורף"). NEVER REMOVE: Emojis; taglines or context lines; other event content. Do not summarize or shorten. Before returning, verify: no URL in urls appears in fullDescription, and no link title (urls[].Title) that was the label for that link in the message appears in fullDescription. Output must be HTML only; do not output raw * _ backtick or ~ (input is already HTML).
- fullDescription examples: REMOVE "כרטיסים אחרונים" and the URL when they appear together and you extracted that link to urls with Title "כרטיסים אחרונים". KEEP "כרטיסים למטה בלינק" or "בקישור המצורף" when they are generic and do not repeat the link. KEEP "כרטיסים והרשמה - בקישור המצורף" even when a link follows.
- location.City: NORMALIZED city/town name (e.g. "תל אביב" even if message says "ת"א"). Use standard Hebrew spelling. If not found, use "".
- location.CityEvidence: The VERBATIM snippet from the message/image that indicates the city (e.g. "ת"א" or "חיפה"). Required for verification. null only if no city is mentioned at all.
- location.addressLine1: Venue/place name only — if explicitly stated. Otherwise null.
- location.addressLine2: Street address only — if explicitly stated. Otherwise null.
- location.locationDetails: ONLY practical navigation/arrival instructions (e.g. "ימינה בכיכר הגדולה, מול הבית הצהוב" or "לשים בוויז בית השאנטי כדי להגיע"). NOT descriptions of the place (e.g. "מקום יפהפה ומואר" is NOT locationDetails). null if none.
- location.wazeNavLink: Waze URL found in message text. Otherwise null.
- location.gmapsNavLink: Google Maps URL found in message text. Otherwise null.
- price: Event/entrance price (what attendees pay to participate). Usually when a price appears in the message it is the event price — it does not need to appear next to כניסה, מחיר כניסה, or דמי כניסה. Ignore a price only when it is clearly the price of items sold at the event (e.g. costumes — תחפושות ב-X, מכירת תחפושות ב-X; food — פופקורן, דוכני אוכל; merchandise). In that case do not use that number; if no other price is given, set price to null. 0 if free is explicitly stated. null if no price is mentioned or unclear.
- occurrences: Array of occurrence objects. Each object has:
  - date: REQUIRED. YYYY-MM-DD (Israel local calendar date). Must match the date used for startTime when startTime is converted to Israel local.
  - hasTime: true if a specific time is mentioned; false if only a date is given (all-day event).
  - startTime: ISO UTC string. If hasTime true: combine date with stated time (Israel local), convert to UTC. If hasTime false: date at Israel local 00:00 converted to UTC.
  - endTime: ISO UTC string or null.
- media: Always return an empty array []. Media (images from the message) are added by the system from the actual WhatsApp attachment only. Do NOT put links or URLs here; links go in urls.
- urls: Array of {Title, Url} for links found in the message.
- justifications: For each key state source (text or image) and the exact snippet. If from image, quote the relevant text as read from the image; if from message, quote the relevant part of the message. If from multiple places, list them. When a field has no source in message or image, you MUST use exactly this phrase (no variants): "Not stated in message or image."
  - justifications.date: Source and exact snippet for the CALENDAR DATE only (e.g. "Text: '25/02'", "Image: '17/2'", "Text: 'יום שלישי 17/2'"). If no date in message or image, use exactly: "Not stated in message or image."
  - justifications.location: Source and exact snippet(s). If null/empty location, use exactly: "Not stated in message or image."
  - justifications.startTime: Source and exact snippet for the TIME OF DAY only (e.g. "Text: 'ב 20:00'", "Text: 'החל משעה 17:00'"). If no time or all-day event, use exactly: "Not stated in message or image."
  - justifications.endTime: Source and snippet(s), or exactly: "Not stated in message or image."
  - justifications.price: Source and snippet(s), or exactly: "Not stated in message or image."

IMAGE RULES:
- Message text is PRIMARY source.
- Image is SECONDARY — use only if text is clearly readable with high confidence.
- If image is blurry or ambiguous, ignore it.
- When text in the image contains date, time, location, or price, use it and cite it in justifications (e.g. "Image: 'יום שלישי 17/2, 17:00'").

EXAMPLE:
Message: "🎶 ערב מוזיקה אתיופית - 25/02 בשעה 20:00\nמתחם שוק תלפיות, חיפה\nכניסה: 30 ₪\nhttps://ul.waze.com/ul?place=abc"
→ {
  "Title": "ערב מוזיקה אתיופית",
  "shortDescription": "ערב של מוזיקה אתיופית",
  "fullDescription": "<p>🎶 ערב מוזיקה אתיופית - 25/02 בשעה 20:00</p><p>מתחם שוק תלפיות, חיפה</p><p>כניסה: 30 ₪</p>",
  "categories": ["music"],
  "mainCategory": "music",
  "location": { "City": "חיפה", "CityEvidence": "חיפה", "addressLine1": "מתחם שוק תלפיות", "addressLine2": null, "locationDetails": null, "wazeNavLink": "https://ul.waze.com/ul?place=abc", "gmapsNavLink": null },
  "price": 30,
  "occurrences": [{ "date": "2026-02-25", "hasTime": true, "startTime": "2026-02-25T18:00:00.000Z", "endTime": null }],
  "media": [],
  "urls": [{ "Title": "ניווט Waze", "Url": "https://ul.waze.com/ul?place=abc" }],
  "justifications": {
    "date": "Text: '25/02'",
    "location": "Text: 'מתחם שוק תלפיות, חיפה'",
    "startTime": "Text: 'בשעה 20:00'",
    "endTime": "Not stated in message or image.",
    "price": "Text: 'כניסה: 30 ₪'"
  }
}`

  let userContent
  if (hasImage) {
    userContent = [
      { type: 'text', text: `Extract event from this WhatsApp message (message body below is already in HTML):\n\n${messageBodyHtml || '(no text — check image)'}\n\nLinks found: ${allUrls.length > 0 ? allUrls.join(', ') : '(none)'}` },
      { type: 'image_url', image_url: { url: cloudinaryUrl } },
    ]
  } else {
    userContent = `Extract event from this WhatsApp message (message body below is already in HTML):\n\n${messageBodyHtml || '(empty)'}\n\nLinks found: ${allUrls.length > 0 ? allUrls.join(', ') : '(none)'}`
  }

  const maxAttempts = OPENAI.MAX_ATTEMPTS
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_schema', json_schema: EXTRACTION_SCHEMA },
        max_tokens: config.openai.maxTokens,
        temperature: 0.1,
      })

      const content = response.choices[0]?.message?.content
      if (!content) return null

      let parsed
      try {
        parsed = JSON.parse(content)
      } catch (parseErr) {
        const parseMsg = parseErr instanceof Error ? parseErr.message : String(parseErr)
        logger.error(LOG_PREFIXES.EVENT_SERVICE, 'Extraction invalid JSON response', { message: parseMsg, contentLength: content.length })
        return null
      }
      await incrementOpenAICalls()
      return parsed
    } catch (error) {
      const errLog = formatOpenAIErrorForLog(error)
      logger.error(LOG_PREFIXES.EVENT_SERVICE, `Extraction API error (attempt ${attempt}/${maxAttempts})`, errLog)
      if (attempt < maxAttempts && isRetryableOpenAIError(error)) {
        const delay = getRetryDelayMs(error, attempt - 1)
        logger.info(LOG_PREFIXES.EVENT_SERVICE, `OpenAI retrying in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`, errLog)
        await sleep(delay)
      } else {
        logger.warn(LOG_PREFIXES.EVENT_SERVICE, 'Extraction failed after max attempts', { attempts: maxAttempts, ...errLog })
        return null
      }
    }
  }
  logger.warn(LOG_PREFIXES.EVENT_SERVICE, 'Extraction failed after all retries', { attempts: maxAttempts })
  return null
}

export async function callOpenAIForComparison(extractedEvent, messageText, candidates) {
  messageText = sanitizeMessageForPrompt(messageText || '')
  const candidatesText = candidates.map((c, i) => {
    const id = c._id.toString()
    const text = c.rawMessage?.text || '(no text)'
    const title = c.event?.Title || '(no title)'
    const city = c.event?.location?.City || ''
    const occ = c.event?.occurrences?.[0]
    const date = occ?.date || '(none)'
    const start = occ?.startTime || ''
    return `Candidate ${i + 1}:\nID: ${id}\nTitle: ${title}\nCity: ${city}\nDate: ${date}\nStartTime: ${start}\nMessage: ${text}`
  }).join('\n\n')

  const systemPrompt = `You are an event comparison assistant. Given a newly extracted event and a list of candidate events from the database, decide if the new event is:
- "new_event": Different event (different name, location, date, or type) OR no match
- "existing_event": Same event, no meaningful changes (just a repost)
- "updated_event": Same event, but with changes to price, dates, links, location details, or description

Two events are the SAME only if ALL match: similar title, same city, same category type, same or very close date.

If "existing_event" or "updated_event", provide the matchedCandidateId.
Provide a short reason for your decision.

EXAMPLE:
New event title "ערב מוזיקה אתיופית" in חיפה on 2026-02-25, and candidate has title "ערב מוזיקה אתיופית" in חיפה on 2026-02-25 → "existing_event"
Same but candidate price was 30 and new message says 50 → "updated_event"
New event is "סדנת קרמיקה" but candidate is "ערב מוזיקה" → "new_event"`

  const extractedOcc = extractedEvent.occurrences?.[0]
  const userContent = `NEW EVENT:
Title: ${extractedEvent.Title}
City: ${extractedEvent.location?.City || '(none)'}
Date: ${extractedOcc?.date || '(none)'}
StartTime: ${extractedOcc?.startTime || '(none)'}
Categories: ${(extractedEvent.categories || []).join(', ')}
Message text: ${messageText || '(empty)'}

CANDIDATES:
${candidatesText}

Decide: new_event, existing_event, or updated_event?`

  const maxAttempts = OPENAI.MAX_ATTEMPTS
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_schema', json_schema: COMPARISON_SCHEMA },
        max_tokens: 300,
        temperature: 0.1,
      })

      const content = response.choices[0]?.message?.content
      if (!content) return null

      let parsed
      try {
        parsed = JSON.parse(content)
      } catch (parseErr) {
        const parseMsg = parseErr instanceof Error ? parseErr.message : String(parseErr)
        logger.error(LOG_PREFIXES.EVENT_SERVICE, 'Comparison invalid JSON response', { message: parseMsg, contentLength: content.length })
        return null
      }
      await incrementOpenAICalls()
      return parsed
    } catch (error) {
      const errLog = formatOpenAIErrorForLog(error)
      logger.error(LOG_PREFIXES.EVENT_SERVICE, `Comparison API error (attempt ${attempt}/${maxAttempts})`, errLog)
      if (attempt < maxAttempts && isRetryableOpenAIError(error)) {
        const delay = getRetryDelayMs(error, attempt - 1)
        logger.info(LOG_PREFIXES.EVENT_SERVICE, `OpenAI retrying in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`, errLog)
        await sleep(delay)
      } else {
        logger.warn(LOG_PREFIXES.EVENT_SERVICE, 'Comparison failed after max attempts', { attempts: maxAttempts, ...errLog })
        return null
      }
    }
  }
  logger.warn(LOG_PREFIXES.EVENT_SERVICE, 'Comparison failed after all retries', { attempts: maxAttempts })
  return null
}

/**
 * Pass A — Evidence Locator: output only evidence candidates for date, timeOfDay, location, price.
 * @param {import('../../../../types/events').EventSourceDocument} sourceDocument
 * @returns {Promise<{ evidenceCandidates: { date: Array<{quote,source}>, timeOfDay: [], location: [], price: [] } } | null>}
 */
export async function callOpenAIForEvidenceLocator(sourceDocument) {
  const dateCtx = getDateTimeContext()
  const messageText = sourceDocument?.messageTextSanitized ?? ''
  const ocrText = sourceDocument?.ocrText ?? ''
  const urls = sourceDocument?.extractedUrls ?? []
  const urlsLine = urls.length > 0 ? `Links: ${urls.join(', ')}` : 'Links: (none)'
  const systemPrompt = `You are an evidence locator for a Hebrew community events calendar.
Given message text and optional OCR text, list ALL candidate quotes for: calendar DATE, time of day, LOCATION, PRICE.
You MUST look for date evidence in BOTH the message text AND the OCR text (image). If either contains a date, add it to the date array.
Date evidence includes: DD.MM or D.M (e.g. 2.3, 18.2), Hebrew date (e.g. י"ג אדר), weekday (e.g. יום שני, רביעי), month names, "היום"/"מחר", or any line/phrase that clearly indicates when the event is (e.g. "2.3 • י\"ג אדר • יום שני"). Date evidence can also be a range or multiple dates (e.g. 18-23.2, 18.2-1.3, 18 עד 21 בפברואר); return the exact quote as written. Use the exact quote as it appears; do not normalize.
Do NOT output normalized dates or UTC. Only exact quotes and source (message_text, ocr_text, or url).
${dateCtx}
Return evidenceCandidates with arrays: date, timeOfDay, location, price. Each item: quote, source. Never leave date empty when the source (message or OCR) contains any date-like information.`
  const userParts = [`Message text:\n${messageText || '(empty)'}`, urlsLine, dateCtx]
  if (ocrText) userParts.push(`OCR text:\n${ocrText.slice(0, 4000)}`)
  const userContent = userParts.join('\n\n')
  for (let attempt = 1; attempt <= OPENAI.MAX_ATTEMPTS; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
        response_format: { type: 'json_schema', json_schema: EVIDENCE_LOCATOR_SCHEMA },
        max_tokens: 2000,
        temperature: 0.1,
      })
      const content = response.choices[0]?.message?.content
      if (!content) return null
      let parsed
      try {
        parsed = JSON.parse(content)
      } catch (parseErr) {
        const parseMsg = parseErr instanceof Error ? parseErr.message : String(parseErr)
        logger.error(LOG_PREFIXES.EVENT_SERVICE, 'Evidence locator invalid JSON response', { message: parseMsg, contentLength: content.length })
        return null
      }
      if (parsed?.evidenceCandidates) {
        await incrementOpenAICalls()
        return parsed
      }
      return null
    } catch (error) {
      const errLog = formatOpenAIErrorForLog(error)
      logger.error(LOG_PREFIXES.EVENT_SERVICE, `Evidence locator API error (attempt ${attempt}/${OPENAI.MAX_ATTEMPTS})`, errLog)
      if (attempt < OPENAI.MAX_ATTEMPTS && isRetryableOpenAIError(error)) {
        const delay = getRetryDelayMs(error, attempt - 1)
        logger.info(LOG_PREFIXES.EVENT_SERVICE, `OpenAI retrying in ${delay}ms (attempt ${attempt + 1}/${OPENAI.MAX_ATTEMPTS})`, errLog)
        await sleep(delay)
      } else {
        logger.warn(LOG_PREFIXES.EVENT_SERVICE, 'Evidence locator failed after max attempts', { attempts: OPENAI.MAX_ATTEMPTS, ...errLog })
        return null
      }
    }
  }
  logger.warn(LOG_PREFIXES.EVENT_SERVICE, 'Evidence locator failed after all retries', { attempts: OPENAI.MAX_ATTEMPTS })
  return null
}

/**
 * Pass B — Description Builder: Title, shortDescription, fullDescription, categories, mainCategory, urls.
 * @param {import('../../../../types/events').EventSourceDocument} sourceDocument
 * @param {{ location?: object, price?: number|null }} verifiedCriticalSummary
 * @param {Array<{id: string, label: string}>} categoriesList
 * @returns {Promise<{ Title: string, shortDescription: string, fullDescription: string, categories: string[], mainCategory: string, urls: Array<{Title: string, Url: string}> } | null>}
 */
export async function callOpenAIForDescriptionBuilder(sourceDocument, verifiedCriticalSummary, categoriesList) {
  const messageHtml = sourceDocument?.messageHtml ?? ''
  const messageText = sourceDocument?.messageTextSanitized ?? ''
  const ocrText = sourceDocument?.ocrText ?? ''
  const extractedUrls = sourceDocument?.extractedUrls ?? []
  const categoriesText = categoriesList.map((c) => `- ${c.id}: ${c.label}`).join('\n')
  const summary = verifiedCriticalSummary ? `Verified location: ${verifiedCriticalSummary.location?.City ?? '(none)'}; price: ${verifiedCriticalSummary.price ?? 'null'}` : ''
  const systemPrompt = `You are a description builder for a Hebrew community events calendar. Produce only: Title, shortDescription, fullDescription (HTML with <p>,<br>,<strong>,<em>,<ul>,<ol>,<li>), categories, mainCategory, urls ({Title,Url}).

Title (event name) — important. Prefer in this order: (1) The name the publishers gave the event: look for a prominent headline in the OCR (image) or in the message (e.g. first line, or a line that is clearly the event name). Use it as-is or slightly cleaned (e.g. "פותחים את פורים יחד" or "קריאת מגילה קהילתית"). (2) If no clear publisher name, build a specific title from the main activity type plus location or key detail (e.g. "קריאת מגילה קהילתית - מבוע צפון", "סדנאות פורים בנאות מרדכי"). Never use generic placeholders like "אירוע קהילתי" when the message or image contain enough detail. The title must sound like a real event name: specific, recognizable, not vague or sloppy.

Categories rule: Use ONLY category ids from the list below. mainCategory is the one primary category. categories MUST be an array that includes mainCategory (mainCategory must be one of the elements in categories). Add up to 3 additional ids when the event clearly fits other types (e.g. both music and party). Single-type: categories = [mainCategory]. Multi-type example: categories: ["party", "music"], mainCategory: "party".

Category ids:
${categoriesText}`
  const messageBlock = `Message:\n${messageHtml || messageText || '(empty)'}`
  const ocrBlock = ocrText ? `\n\nOCR text (from image; use for poster titles and details):\n${ocrText.slice(0, 3000)}` : ''
  const userContent = `${summary}\n\n${messageBlock}${ocrBlock}\n\nLinks: ${extractedUrls.length > 0 ? extractedUrls.join(', ') : '(none)'}`
  for (let attempt = 1; attempt <= OPENAI.MAX_ATTEMPTS; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
        response_format: { type: 'json_schema', json_schema: DESCRIPTION_BUILDER_SCHEMA },
        max_tokens: config.openai.maxTokens,
        temperature: 0.1,
      })
      const content = response.choices[0]?.message?.content
      if (!content) return null
      let parsed
      try {
        parsed = JSON.parse(content)
      } catch (parseErr) {
        const parseMsg = parseErr instanceof Error ? parseErr.message : String(parseErr)
        logger.error(LOG_PREFIXES.EVENT_SERVICE, 'Description builder invalid JSON response', { message: parseMsg, contentLength: content.length })
        return null
      }
      await incrementOpenAICalls()
      return parsed
    } catch (error) {
      const errLog = formatOpenAIErrorForLog(error)
      logger.error(LOG_PREFIXES.EVENT_SERVICE, `Description builder API error (attempt ${attempt}/${OPENAI.MAX_ATTEMPTS})`, errLog)
      if (attempt < OPENAI.MAX_ATTEMPTS && isRetryableOpenAIError(error)) {
        const delay = getRetryDelayMs(error, attempt - 1)
        logger.info(LOG_PREFIXES.EVENT_SERVICE, `OpenAI retrying in ${delay}ms (attempt ${attempt + 1}/${OPENAI.MAX_ATTEMPTS})`, errLog)
        await sleep(delay)
      } else {
        logger.warn(LOG_PREFIXES.EVENT_SERVICE, 'Description builder failed after max attempts', { attempts: OPENAI.MAX_ATTEMPTS, ...errLog })
        return null
      }
    }
  }
  logger.warn(LOG_PREFIXES.EVENT_SERVICE, 'Description builder failed after all retries', { attempts: OPENAI.MAX_ATTEMPTS })
  return null
}

/**
 * Optional Chain-of-Verification: yes/no per field.
 * @param {object} verifiedEvent
 * @param {object} evidenceQuotes
 * @returns {Promise<{ fields: Array<{ fieldName: string, ok: boolean, suggestedValue: string|null, reason: string }> } | null>}
 */
export async function callOpenAIForFieldVerification(verifiedEvent, evidenceQuotes) {
  const systemPrompt = `You are a field verification assistant. Given chosen values and evidence quotes, answer yes/no per field (date, timeOfDay, location, price). If no, suggest corrected value or null; suggestedValue must be supported by evidence.`
  const userContent = `Chosen:\n${JSON.stringify(verifiedEvent, null, 2)}\n\nEvidence:\n${JSON.stringify(evidenceQuotes, null, 2)}`
  for (let attempt = 1; attempt <= OPENAI.MAX_ATTEMPTS; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
        response_format: { type: 'json_schema', json_schema: FIELD_VERIFICATION_SCHEMA },
        max_tokens: 600,
        temperature: 0.1,
      })
      const content = response.choices[0]?.message?.content
      if (!content) return null
      let parsed
      try {
        parsed = JSON.parse(content)
      } catch (parseErr) {
        const parseMsg = parseErr instanceof Error ? parseErr.message : String(parseErr)
        logger.error(LOG_PREFIXES.EVENT_SERVICE, 'Field verification invalid JSON response', { message: parseMsg, contentLength: content.length })
        return null
      }
      await incrementOpenAICalls()
      return parsed
    } catch (error) {
      const errLog = formatOpenAIErrorForLog(error)
      logger.error(LOG_PREFIXES.EVENT_SERVICE, `Field verification API error (attempt ${attempt}/${OPENAI.MAX_ATTEMPTS})`, errLog)
      if (attempt < OPENAI.MAX_ATTEMPTS && isRetryableOpenAIError(error)) {
        const delay = getRetryDelayMs(error, attempt - 1)
        logger.info(LOG_PREFIXES.EVENT_SERVICE, `OpenAI retrying in ${delay}ms (attempt ${attempt + 1}/${OPENAI.MAX_ATTEMPTS})`, errLog)
        await sleep(delay)
      } else {
        logger.warn(LOG_PREFIXES.EVENT_SERVICE, 'Field verification failed after max attempts', { attempts: OPENAI.MAX_ATTEMPTS, ...errLog })
        return null
      }
    }
  }
  logger.warn(LOG_PREFIXES.EVENT_SERVICE, 'Field verification failed after all retries', { attempts: OPENAI.MAX_ATTEMPTS })
  return null
}

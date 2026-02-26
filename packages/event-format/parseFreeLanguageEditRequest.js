/**
 * Parse free-language edit request (event edit flow).
 * User types free text; LLM returns unclear | complete_update | edits.
 * Used by wa-bot when in EVENT_ADD_EDIT_MENU and user sends text (not list reply).
 */
import OpenAI from 'openai'
import { getCurrentIsraelUtcOffset } from './israelDate.js'

const DEFAULT_MODEL = 'gpt-4o-mini'
const LOG_PREFIX = '[event-format]'

const ALLOWED_FIELD_KEYS = new Set([
  'title',
  'shortDescription',
  'fullDescription',
  'mainCategory',
  'categories',
  'location',
  'locationName',
  'City',
  'addressLine1',
  'addressLine2',
  'locationDetails',
  'wazeNavLink',
  'gmapsNavLink',
  'datetime',
  'occurrences',
  'price',
  'links',
  'media',
])

const PARSE_FREE_EDIT_SCHEMA = {
  name: 'parse_free_language_edit',
  strict: true,
  schema: {
    type: 'object',
    required: ['type', 'message', 'edits'],
    additionalProperties: false,
    properties: {
      type: { type: 'string', enum: ['unclear', 'complete_update', 'edits'] },
      message: { type: 'string' },
      edits: {
        type: 'array',
        items: {
          type: 'object',
          required: ['fieldKey', 'justification', 'newValueStr'],
          additionalProperties: false,
          properties: {
            fieldKey: { type: 'string' },
            justification: { type: 'string' },
            newValueStr: { type: 'string' },
          },
        },
      },
    },
  },
}

function buildSystemPrompt(menuOptions, currentEventSummary) {
  const menuLines = (menuOptions || []).map((o) => `- ${o.id}: ${o.title}`).join('\n')
  const offset = getCurrentIsraelUtcOffset()
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' })
  const parts = formatter.formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value ?? ''
  const m = parts.find((p) => p.type === 'month')?.value ?? ''
  const d = parts.find((p) => p.type === 'day')?.value ?? ''
  const dateContext = `Current date (Israel): ${y}-${m}-${d}. Israel UTC offset: UTC+${offset}. Convert Israel times to UTC by subtracting ${offset} (e.g. 13:00 Israel → ${13 - offset}:00 UTC, 19:00 Israel → ${19 - offset}:00 UTC). Hebrew: "בצהריים" = afternoon, "1 בצהריים" = 13:00, "7 בערב" = 19:00, "10 בערב" = 22:00.`

  return `You are an assistant for a Hebrew event-edit flow. The user is editing an event and can either choose a field from a menu or type in free language.

${dateContext}

MENU OPTIONS (id and title):
${menuLines}

CURRENT EVENT (summary for context):
${currentEventSummary}

Allowed field keys for edits (use exactly these when proposing edits):
- title (string) — event title
- shortDescription (string) — short summary
- fullDescription (string) — full description (may contain HTML)
- mainCategory (string) — main category id
- categories (array of strings) — category ids
- location (object) — full location: { City, locationName?, addressLine1?, addressLine2?, locationDetails?, wazeNavLink?, gmapsNavLink?, region?, cityId?, cityType? }. region = center|golan|upper; cityType = listed|custom.
- locationName, City, addressLine1, addressLine2, locationDetails, wazeNavLink, gmapsNavLink, region (strings) — single location sub-fields
- datetime or occurrences (array) — the COMPLETE new occurrences array after applying the user's requested changes. Each item: { date: "YYYY-MM-DD", hasTime: true/false, startTime: "YYYY-MM-DDTHH:mm:ssZ", endTime: "YYYY-MM-DDTHH:mm:ssZ" or null }. All times in UTC. See "Date/time (occurrences) edits" below.
- price (number or null)
- links (array) — urls and phones: [{ Title: "string", Url: "string", type: "link"|"phone" }]. For phone change use type "phone" and Url as digits (e.g. "0507153850").
- media (array) — list of media items

IMPORTANT: When the user clearly requests one or more specific changes (e.g. change phone number, change location/address, add a date, change a time, update several fields in one message), you MUST use type "edits" and list each change as a separate item in the edits array. Do NOT use type "unclear" for multi-edit messages. Use "unclear" only when the message is truly ambiguous or does not indicate what to update.

Date/time (occurrences) edits — the user can request any combination in one message:
- Edit specific occurrence(s): change the time or date of one or more existing occurrences (e.g. "change the time of March 5 to 7pm–10pm", "לערוך את השעה של ה5 למרץ ל שבע בערב עד 10").
- Add occurrence(s): add one or more new dates/times (e.g. "add March 8 1pm–3pm", "להוסיף עוד יום ב8 למרץ בשעה 1 עד 3 בצהריים").
- Remove occurrence(s): remove one or more existing occurrences (e.g. "cancel the event on March 5", "לבטל את ה5 למרץ").
- Combine: e.g. add one day, change another day's time, and remove a third in the same message.
Always output exactly ONE edit with fieldKey "datetime" (or "occurrences"): take "occurrences (current)" from CURRENT EVENT above as the starting array, apply the requested changes (modify in place, append new, delete removed), then set newValueStr to JSON.stringify of the complete new array. Keep any occurrence not mentioned by the user unchanged. All times must be in UTC (Israel offset given above). Hebrew: "ה5 למרץ" = 5th March, "ה8 למרץ" = 8th March, "בצהריים" = afternoon (13:00), "שבע בערב" = 19:00, "עשר" = 22:00.

Respond with valid JSON only. You must always include "message" and "edits" in your response. For type "unclear" set message to your clarification (or ""); set edits to []. For type "complete_update" set message to "" and edits to []. For type "edits" set message to "" and edits to your array of changes. Choose exactly one type:

1) type: "unclear" — ONLY when the message does not clearly indicate what to update or is ambiguous. Do not use for clear requests like "change phone to X", "change location to Y", "add day on date Z". Set message (optional clarification) and edits: [].

2) type: "complete_update" — when the user clearly indicates they are done updating (e.g. "סיימתי לעדכן", "זהו", "מספיק"). Set message: "" and edits: [].

3) type: "edits" — when the user requests any specific field update(s). Set message: "" and "edits" to an array of { "fieldKey", "justification", "newValueStr" }. You may have multiple items (e.g. one for links, one for location, one for datetime). justification: short Hebrew snippet from the user message. newValueStr: JSON string of the value (JSON.stringify). Examples: phone "0507153850" → links: [{"Title":"טלפון","Url":"0507153850","type":"phone"}]; location text → location: {"locationName":"מקום המטבח","addressLine1":"לקפה פילוסופ"} or use locationName + addressLine1; for date/time changes use a single datetime edit with the full merged occurrences array (see "Date/time (occurrences) edits" above).

Output only valid JSON matching the schema.`
}

/**
 * Build a short summary of the current event for the LLM (field names + values).
 * @param {Record<string, unknown>} currentEvent - eventAddFormattedPreview (Title, shortDescription, fullDescription, mainCategory, categories, location, occurrences, price, urls, media)
 */
function buildCurrentEventSummary(currentEvent) {
  if (!currentEvent || typeof currentEvent !== 'object') return '(no event)'
  const ev = currentEvent
  const loc = ev.location && typeof ev.location === 'object' ? ev.location : {}
  const parts = [
    `title (שם האירוע): ${String(ev.Title ?? '').slice(0, 200)}`,
    `shortDescription: ${String(ev.shortDescription ?? '').slice(0, 300)}`,
    `fullDescription: [HTML, ${String(ev.fullDescription ?? '').length} chars]`,
    `mainCategory: ${ev.mainCategory ?? ''}`,
    `categories: ${Array.isArray(ev.categories) ? ev.categories.join(', ') : ''}`,
    `locationName: ${loc.locationName ?? ''}`,
    `City: ${loc.City ?? ''}`,
    `addressLine1: ${loc.addressLine1 ?? ''}`,
    `addressLine2: ${loc.addressLine2 ?? ''}`,
    `locationDetails: ${loc.locationDetails ?? ''}`,
    `wazeNavLink: ${loc.wazeNavLink ?? ''}`,
    `gmapsNavLink: ${loc.gmapsNavLink ?? ''}`,
    `occurrences (current): ${Array.isArray(ev.occurrences) ? JSON.stringify(ev.occurrences) : '[]'}`,
    `price: ${ev.price}`,
    `urls: ${Array.isArray(ev.urls) ? ev.urls.length : 0} items`,
    `media: ${Array.isArray(ev.media) ? ev.media.length : 0} items`,
  ]
  return parts.join('\n')
}

/**
 * Parse user free-text into structured edit intent.
 * @param {string} userMessage - User's free text
 * @param {Array<{ id: string, title: string }>} menuOptions - Edit menu rows (done + fields)
 * @param {Record<string, unknown>} currentEvent - eventAddFormattedPreview
 * @param {{ openaiApiKey?: string, openaiModel?: string, correlationId?: string }} [options]
 * @returns {Promise<{ type: 'unclear' | 'complete_update' | 'edits', message?: string, edits?: Array<{ fieldKey: string, justification: string, newValue: unknown }> }>}
 */
export async function parseFreeLanguageEditRequest(userMessage, menuOptions, currentEvent, options = {}) {
  const apiKey = (options.openaiApiKey ?? process.env.OPENAI_API_KEY ?? '').trim()
  const model = (options.openaiModel ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL
  const correlationId = options.correlationId

  if (!apiKey) {
    console.warn(LOG_PREFIX, correlationId || 'wa-bot', 'parseFreeLanguageEditRequest: no OpenAI API key')
    return { type: 'unclear' }
  }

  const messageTrimmed = typeof userMessage === 'string' ? userMessage.trim() : ''
  if (!messageTrimmed) {
    return { type: 'unclear' }
  }

  const currentEventSummary = buildCurrentEventSummary(currentEvent)

  try {
    const openai = new OpenAI({ apiKey, timeout: 30_000 })
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt(menuOptions, currentEventSummary) },
        { role: 'user', content: messageTrimmed },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: PARSE_FREE_EDIT_SCHEMA,
      },
      max_tokens: 1500,
      temperature: 0.2,
    })
    const content = response.choices[0]?.message?.content
    if (!content) {
      console.warn(LOG_PREFIX, correlationId || 'wa-bot', 'parseFreeLanguageEditRequest: empty content')
      return { type: 'unclear' }
    }
    const parsed = JSON.parse(content)
    const type = parsed.type === 'edits' ? 'edits' : parsed.type === 'complete_update' ? 'complete_update' : 'unclear'
    if (type === 'unclear' && parsed.type !== undefined && parsed.type !== 'unclear') {
      console.warn(LOG_PREFIX, correlationId || 'wa-bot', 'parseFreeLanguageEditRequest: LLM returned type', parsed.type, '(treated as unclear)')
    }
    if (type === 'unclear') {
      const message = typeof parsed.message === 'string' && parsed.message.trim() ? parsed.message.trim() : undefined
      return { type: 'unclear', message }
    }
    if (type === 'complete_update') {
      return { type: 'complete_update' }
    }
    // type === 'edits'
    const rawEdits = Array.isArray(parsed.edits) ? parsed.edits : []
    const edits = []
    for (const e of rawEdits) {
      if (!e || typeof e.fieldKey !== 'string' || !ALLOWED_FIELD_KEYS.has(e.fieldKey)) continue
      let newValue
      try {
        newValue = JSON.parse(e.newValueStr)
      } catch {
        newValue = e.newValueStr
      }
      const fieldKey = e.fieldKey === 'occurrences' ? 'datetime' : e.fieldKey
      edits.push({
        fieldKey,
        justification: typeof e.justification === 'string' ? e.justification.trim() : '',
        newValue,
      })
    }
    if (edits.length === 0) {
      console.warn(LOG_PREFIX, correlationId || 'wa-bot', 'parseFreeLanguageEditRequest: LLM returned edits but all filtered out (invalid fieldKey or newValueStr)', rawEdits.length, 'raw')
      return { type: 'unclear' }
    }
    return { type: 'edits', edits }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(LOG_PREFIX, correlationId || 'wa-bot', 'parseFreeLanguageEditRequest failed', msg)
    return { type: 'unclear' }
  }
}

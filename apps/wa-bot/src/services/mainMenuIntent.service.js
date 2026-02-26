/**
 * Main menu intent classification: map free-language user message to a menu action.
 * Used when user sends text at welcome or publisher-choice step (if allowMainMenuFreeLanguage).
 */
import OpenAI from 'openai'
import { LOG_PREFIXES } from '../consts/index.js'
import { logger } from '../utils/logger.js'

const DEFAULT_MODEL = 'gpt-4o-mini'

const VALID_INTENTS = new Set([
  'discover',
  'publish',
  'event_add_new',
  'event_update',
  'event_delete',
  'contact',
  'irrelevant',
  'unclear',
])

const INTENT_SCHEMA = {
  name: 'main_menu_intent',
  strict: true,
  schema: {
    type: 'object',
    required: ['intent'],
    additionalProperties: false,
    properties: {
      intent: {
        type: 'string',
        enum: Array.from(VALID_INTENTS),
      },
    },
  },
}

const SYSTEM_PROMPT = `You are an intent classifier for a Hebrew WhatsApp bot (Galiluz - events in the North).

The user sent a message from the main menu. Classify into exactly ONE intent:

- discover: User wants to look up / search / find events. E.g. "מה קורה בצפון", "אילו אירועים יש", "חיפוש אירועים", "מה על today/tomorrow", "מה קורה היום/מחר".
- publish: User wants to register as a publisher or sign up to publish (not yet "add one event now"). E.g. "רוצה להפוך למפרסם", "הרשמה לפרסום", "להצטרף כמפרסם".
- event_add_new: User wants to add / publish / post a new event now. E.g. "לפרסם אירוע", "להוסיף אירוע", "אירוע חדש", "להעלות אירוע".
- event_update: User wants to update / edit / change an existing event. E.g. "לעדכן אירוע", "עריכת אירוע", "לשנות אירוע קיים".
- event_delete: User wants to delete / remove an event. E.g. "למחוק אירוע", "מחיקת אירוע", "להסיר אירוע".
- contact: User wants to contact / get in touch / talk to someone / get phone or wa.me. E.g. "צרו קשר", "ליצור קשר", "להתקשר", "טלפון", "לשוחח".
- irrelevant: The request is something we cannot help with (e.g. order food, unrelated topic, spam). We only offer: discover events, publish/update/delete events, contact.
- unclear: Cannot determine what the user wants; message is too vague, empty, or ambiguous.

Respond with valid JSON only: { "intent": "<one of the enum values>" }.`

/**
 * Classify user message into main-menu intent.
 * @param {string} userMessage - Trimmed user text
 * @param {{ openaiApiKey?: string, openaiModel?: string }} [options]
 * @returns {Promise<{ intent: 'discover'|'publish'|'event_add_new'|'event_update'|'event_delete'|'contact'|'irrelevant'|'unclear' }>}
 */
export async function classifyMainMenuIntent(userMessage, options = {}) {
  const apiKey = (options.openaiApiKey ?? '').trim()
  const model = (options.openaiModel ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL

  if (!apiKey) {
    logger.warn(LOG_PREFIXES.WEBHOOK, 'classifyMainMenuIntent: no OpenAI API key, returning unclear')
    return { intent: 'unclear' }
  }

  const messageTrimmed = typeof userMessage === 'string' ? userMessage.trim() : ''
  if (!messageTrimmed) {
    return { intent: 'unclear' }
  }

  try {
    const openai = new OpenAI({ apiKey, timeout: 15_000 })
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: messageTrimmed },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: INTENT_SCHEMA,
      },
      max_tokens: 50,
      temperature: 0.1,
    })
    const content = response.choices[0]?.message?.content
    if (!content) {
      logger.warn(LOG_PREFIXES.WEBHOOK, 'classifyMainMenuIntent: empty content')
      return { intent: 'unclear' }
    }
    const parsed = JSON.parse(content)
    const intent = VALID_INTENTS.has(parsed.intent) ? parsed.intent : 'unclear'
    return { intent }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.warn(LOG_PREFIXES.WEBHOOK, 'classifyMainMenuIntent failed', msg)
    return { intent: 'unclear' }
  }
}

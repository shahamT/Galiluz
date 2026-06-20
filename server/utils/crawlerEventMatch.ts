import OpenAI from 'openai'
import { sanitizeMessageForPrompt } from '~/server/utils/sanitizeMessageForPrompt'

// Use Node's native fetch — the bundled SDK otherwise falls back to node-fetch v2,
// which throws ERR_STREAM_PREMATURE_CLOSE on Node 22 while decompressing gzipped
// responses (see packages/event-format/freeLanguageExtract.js for the full note).
const nativeFetch = (...args: Parameters<typeof globalThis.fetch>) => globalThis.fetch(...args)

export interface MatchCandidate {
  id: string
  title: string
  city: string
  date: string // first future occurrence YYYY-MM-DD
}

const MATCH_SCHEMA = {
  name: 'crawler_event_match',
  strict: true,
  schema: {
    type: 'object',
    required: ['matchedId', 'reason'],
    additionalProperties: false,
    properties: {
      // id of an existing event this is the SAME as, or null if it's a new event.
      matchedId: { type: ['string', 'null'] },
      reason: { type: ['string', 'null'] },
    },
  },
}

const SYSTEM_PROMPT = `You compare a newly detected event against a list of existing events from the same account, to avoid creating a duplicate draft.

Decide whether the NEW event is the SAME real-world event as one of the CANDIDATES.
Two events are the SAME only if they clearly refer to the same happening: similar title/topic AND same city AND same or very close date. A repost of the same event = same. A different event (different name, place, or date) = NOT the same.

Return matchedId = the candidate's ID when it is the same event; otherwise matchedId = null. Give a short reason.`

/**
 * AI comparison of a freshly extracted event vs the account's existing future
 * events. Returns the matched candidate id (duplicate) or null (genuinely new).
 * Fail-open to "new" (null) on any error — a deletable duplicate draft is far
 * less harmful than silently dropping a real new event.
 */
export async function matchCrawlerEvent(
  formattedEvent: Record<string, any>,
  candidates: MatchCandidate[],
  messageText: string,
  options: { openaiApiKey?: string; openaiModel?: string } = {},
): Promise<{ matchedId: string | null; reason: string | null }> {
  if (!candidates.length) return { matchedId: null, reason: 'no_candidates' }

  const apiKey = (options.openaiApiKey ?? process.env.OPENAI_API_KEY ?? '').trim()
  const model = (options.openaiModel ?? process.env.OPENAI_MODEL_WEB ?? 'gpt-4o').trim() || 'gpt-4o'
  if (!apiKey) return { matchedId: null, reason: 'no_openai_key' }

  const occ = formattedEvent.occurrences?.[0] || {}
  const candidatesText = candidates
    .map((c, i) => `Candidate ${i + 1}: ID=${c.id} | Title="${c.title}" | City="${c.city}" | Date=${c.date}`)
    .join('\n')
  const userContent = `NEW EVENT:
Title: ${formattedEvent.Title || '(none)'}
City: ${formattedEvent.location?.city || '(none)'}
Date: ${occ.date || '(none)'}
Message: ${sanitizeMessageForPrompt(messageText).slice(0, 2000)}

EXISTING CANDIDATES (same account, future events):
${candidatesText}

Is the NEW event the same as one of the candidates?`

  try {
    const openai = new OpenAI({ apiKey, timeout: 20_000, maxRetries: 0, fetch: nativeFetch })
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_schema', json_schema: MATCH_SCHEMA },
      max_tokens: 200,
      temperature: 0.1,
    })
    const content = response.choices[0]?.message?.content
    if (!content) return { matchedId: null, reason: 'empty_response' }
    const parsed = JSON.parse(content)
    const matchedId = typeof parsed.matchedId === 'string' && candidates.some((c) => c.id === parsed.matchedId)
      ? parsed.matchedId
      : null
    return { matchedId, reason: parsed.reason || null }
  } catch (err) {
    console.error('[crawler/match] OpenAI error:', err instanceof Error ? err.message : String(err))
    return { matchedId: null, reason: 'match_error' }
  }
}

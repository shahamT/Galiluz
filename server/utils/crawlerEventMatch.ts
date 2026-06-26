import { createOpenAIClient } from '@galiluz/event-format'
import { sanitizeMessageForPrompt } from '~/server/utils/sanitizeMessageForPrompt'

export interface MatchCandidate {
  id: string
  title: string
  city: string
  date: string // an occurrence date within the match window (YYYY-MM-DD)
  shortDescription: string
}

export interface MatchResult {
  matchedId: string | null // a candidate id only when similarity ≥ threshold; else null
  reason: string | null
  similarity: number // 0–100 confidence that bestCandidate is the same real-world event
  bestCandidateId: string | null // the most-similar candidate the model picked (pre-threshold)
}

// Similarity (0–100) at/above which the new event is considered the SAME as the best
// candidate (a duplicate → skipped). Tuned with scripts/eval (npm run eval:matcher).
export const MATCH_SIMILARITY_THRESHOLD = 70

const MATCH_SCHEMA = {
  name: 'crawler_event_match',
  strict: true,
  schema: {
    type: 'object',
    required: ['bestCandidateId', 'similarity', 'reason'],
    additionalProperties: false,
    properties: {
      // ID of the single most-similar candidate, or null if none is plausibly the same.
      bestCandidateId: { type: ['string', 'null'] },
      // 0–100 confidence that bestCandidate is the SAME real-world happening as the new event.
      similarity: { type: 'number' },
      reason: { type: ['string', 'null'] },
    },
  },
}

const SYSTEM_PROMPT = `You compare a NEWLY detected event against EXISTING events, to avoid creating a duplicate draft.

Pick the single CANDIDATE most likely to be the SAME real-world happening as the NEW event, and give "similarity" = your confidence (0–100) that they are the same one event. If no candidate is plausibly the same, set bestCandidateId = null and similarity = 0.

Score HIGH (same event) when they describe the same single happening even if the wording differs, including:
- a reworded / differently phrased TITLE, emojis, or different word order;
- different AUDIENCE framing or tone (e.g. a broad teaser months ahead vs. a detailed reminder near the date);
- more or less detail (one message short, another long);
- MISSING place and/or date — publishers often put these only in the image, so they're absent from the text. Missing fields must NOT lower the score; rely on the title, the concept/topic, the description, and the original message.

Score LOW (different events) when EITHER:
- the concept/topic/show is genuinely different; OR
- the new event AND the candidate BOTH have a specific event DATE and those dates are NOT the same day. A different date means a SEPARATE event — a new occurrence or repeat — EVEN IF the title, place and description are otherwise IDENTICAL (e.g. a recurring meetup, class, or series posted again for another date). When both dates are present and differ, the date is DECISIVE: score low regardless of how similar everything else is. (If either date is missing/unknown, IGNORE the date entirely and judge by title + concept.)

Do not require exact matches on title or city — but the date rule above is decisive when both dates are present. Examples:
- "ערב שירה בגן" (no date) vs candidate "ערב הקראת שירה בגן הקהילתי – 12.7" → same (~90): same concept/place, date just missing from the new text.
- "מסיבת הקיץ הגדולה!" (no date) vs candidate "מסיבת קיץ – לכל המשפחה" → same (~85): reworded title, one happening, date missing from the new text.
- "הופעה של הלהקה 12.7" vs candidate "הופעה של אותה להקה 9.8" → different (~10): same show, both dated, clearly different dates = separate events.
- "מפגש אקרו ותנועה 2.6" vs candidate "מפגש אקרו ותנועה 16.6" → different (~10): identical title and place, but both dated on different days = two separate meetups.
- "סדנת קרמיקה" vs candidate "ערב ג'אז" → different (~3): different concept.

Return bestCandidateId, similarity (0–100), and a short reason citing the evidence.`

/**
 * AI comparison of a freshly extracted event vs existing future events (the sender's
 * account, plus any same-city/same-date events from other accounts — the caller decides
 * the candidate set). Returns a 0–100 similarity to the best candidate; matchedId is set only
 * when similarity ≥ MATCH_SIMILARITY_THRESHOLD (a duplicate). Fail-open to "new"
 * (matchedId null) on any error — a deletable duplicate draft is far less harmful
 * than silently dropping a real new event.
 */
export async function matchCrawlerEvent(
  formattedEvent: Record<string, any>,
  candidates: MatchCandidate[],
  messageText: string,
  options: { openaiApiKey?: string; openaiModel?: string; correlationId?: string } = {},
): Promise<MatchResult> {
  const correlationId = options.correlationId || ''
  const occ = formattedEvent.occurrences?.[0] || {}
  const newDescription = String(formattedEvent.shortDescription || '').slice(0, 300)
  const newEvent = {
    title: formattedEvent.Title || '',
    city: formattedEvent.location?.city || '',
    date: occ.date || '',
    description: newDescription,
  }

  // No candidates → the account has no future event (incl. drafts WITH a date) to
  // compare against, so this is treated as new. A dateless prior draft lands here.
  if (!candidates.length) {
    console.info(`[crawler/match] ${correlationId} no candidates — treating as new`, JSON.stringify({ newEvent }))
    return { matchedId: null, reason: 'no_candidates', similarity: 0, bestCandidateId: null }
  }

  const apiKey = (options.openaiApiKey ?? process.env.OPENAI_API_KEY ?? '').trim()
  const model = (options.openaiModel ?? process.env.OPENAI_MODEL_WEB ?? 'gpt-4o').trim() || 'gpt-4o'
  if (!apiKey) {
    console.warn(`[crawler/match] ${correlationId} no OpenAI key — treating as new`)
    return { matchedId: null, reason: 'no_openai_key', similarity: 0, bestCandidateId: null }
  }
  const candidatesText = candidates
    .map((c, i) => `Candidate ${i + 1}: ID=${c.id} | Title="${c.title}" | City="${c.city}" | Date=${c.date} | Description="${String(c.shortDescription || '').slice(0, 300)}"`)
    .join('\n')
  const userContent = `NEW EVENT:
Title: ${formattedEvent.Title || '(none)'}
City: ${formattedEvent.location?.city || '(none)'}
Date: ${occ.date || '(none)'}
Description: ${newDescription || '(none)'}
Original message: ${sanitizeMessageForPrompt(messageText).slice(0, 2000)}

EXISTING CANDIDATES:
${candidatesText}

Which candidate is the same real-world event as the NEW event, and how confident are you (0–100)?`

  try {
    const openai = createOpenAIClient({ apiKey, timeout: 20_000, maxRetries: 0 })
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_schema', json_schema: MATCH_SCHEMA },
      max_tokens: 250,
      temperature: 0.1,
    })
    const content = response.choices[0]?.message?.content
    if (!content) return { matchedId: null, reason: 'empty_response', similarity: 0, bestCandidateId: null }
    const parsed = JSON.parse(content)
    const similarity = Math.max(0, Math.min(100, Number(parsed.similarity) || 0))
    const bestCandidateId =
      typeof parsed.bestCandidateId === 'string' && candidates.some((c) => c.id === parsed.bestCandidateId)
        ? parsed.bestCandidateId
        : null
    // Hard date guard: when the new event AND the chosen candidate both carry a specific
    // (different) day, they are SEPARATE events — a repeat/new occurrence — even with an
    // identical title and place. The model under-weights this, so the code enforces it.
    // A missing date on either side falls back to the similarity score alone.
    const bestCandidate = bestCandidateId ? candidates.find((c) => c.id === bestCandidateId) : null
    const newDate = String(occ.date || '')
    const candDate = String(bestCandidate?.date || '')
    const datesConflict = !!newDate && !!candDate && newDate !== candDate
    const matchedId = bestCandidateId && similarity >= MATCH_SIMILARITY_THRESHOLD && !datesConflict ? bestCandidateId : null
    // Log the full comparison + score + date guard + the model's own reason so a wrong
    // same/different call can be understood (and the prompt/threshold tuned) without guessing.
    console.info(
      `[crawler/match] ${correlationId} decision`,
      JSON.stringify({ newEvent, candidates, bestCandidateId, similarity, threshold: MATCH_SIMILARITY_THRESHOLD, datesConflict, matchedId, reason: parsed.reason || null }),
    )
    return { matchedId, reason: parsed.reason || null, similarity, bestCandidateId }
  } catch (err) {
    console.error(`[crawler/match] ${correlationId} OpenAI error:`, err instanceof Error ? err.message : String(err))
    return { matchedId: null, reason: 'match_error', similarity: 0, bestCandidateId: null }
  }
}

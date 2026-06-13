import { extractEventFromFreeText } from '@galiluz/event-format'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { checkRateLimit, checkAiGenerateRateLimit } from '~/server/utils/rateLimit'
import { getCategoriesList } from '~/consts/events.const.js'
import { CITIES as CITIES_MAP } from '~/consts/regions.const.js'
import { getDateInIsraelFromIso, getTimeInIsraelFromIso } from '~/utils/israelDate.js'

// City list shape the extractor expects: { id, title, region }
const CITIES_LIST = Object.entries(CITIES_MAP).map(([id, c]) => ({
  id,
  title: (c as { title: string }).title,
  region: (c as { region: string }).region,
}))

// Web-only refinements appended to the shared extractor's system prompt (via the
// extraInstructions hook). Tuned for the web form: a richer, scannable description
// and deterministic live-music categorization. The wa-bot omits this, so its
// output is unchanged. Allowed HTML is limited to what the form's TipTap editor
// renders first-class (StarterKit, no headings) AND the server sanitizer keeps:
// <p> <br> <strong> <em> <ul> <ol> <li> + emojis — nothing else.
const WEB_EXTRA_INSTRUCTIONS = `ADDITIONAL STYLE & CATEGORY RULES (these refine ONLY rawFullDescription and categories; every other rule above — occurrences/dates, price, location, urls, flags, and factual fidelity — remains in full force).

rawFullDescription — REWRITE it into a visually appealing, easy-to-scan description. This presentation restructuring is REQUIRED and overrides any "preserve the original structure" guidance above. Stay 100% faithful to the facts: never invent or change names, dates, prices, places, or claims — formatting and emojis are decoration only.
- Regroup into short <p> paragraphs. Do NOT just mirror the source's line breaks with <br>; open with a punchy one-line hook, then a short supporting paragraph.
- When the text mentions several activities, offerings, acts, or items (even comma- or "ו"-separated, e.g. "דוכנים, אוכל ומוזיקה"), turn them into a <ul><li> list, one item per <li>. Prefer a bullet list over a long comma sentence.
- Use <strong> on the single most compelling phrase (the hook / headline act) — 1, at most 2, short phrases. Never bold the date, price, or location.
- Add 1-3 tasteful emojis that fit the event's vibe/category as accents (🎶 🎤 🎸 🎷 🎨 🎭 🍷 🍝 🌿 🧘 🎉 👨‍👩‍👧‍👦 ...), even when the source has none. Put one beside the opening hook and optionally as <li> markers. Don't repeat an emoji, don't replace words with emojis, and skip emojis for solemn events (e.g. memorials).
- Allowed tags — ONLY these, nothing else (any other tag is silently stripped): <p> <br> <strong> <em> <ul> <ol> <li>. No attributes, no headings, no <blockquote>/<code>/<s>/<a>. (Keep removing links/phones from the body — never emit an <a> tag.)
Example — raw input: "יריד קהילתי בכיכר המושבה. בדוכנים: יד שנייה, אוכל ביתי ופינת ילדים."
Good rawFullDescription: <p>🎉 <strong>יריד קהילתי בכיכר המושבה</strong></p><p>בדוכנים:</p><ul><li>יד שנייה</li><li>אוכל ביתי</li><li>פינת ילדים</li></ul>

categories — LIVE MUSIC: when the event is a live music performance or concert (its main draw is live musical performance), set mainCategory = "show" and include "music" in categories (both present). This applies to concerts/gigs/live performances only — NOT DJ/dance parties (use "party"), NOT jam sessions (use "jam"), NOT music workshops/courses (use "workshop"/"course").`

/**
 * AI event generation — turns a free-text description (e.g. a pasted WhatsApp
 * message) into a form-ready event DTO using the shared @galiluz/event-format
 * extractor. The web modal applies this onto its form fields and runs its own
 * validation to surface anything the AI could not fill. No persistence here.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)
  await checkRateLimit(event)
  checkAiGenerateRateLimit(session.publisherId)

  const body = await readBody<{ text?: string }>(event)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) {
    throw createError({ statusCode: 400, message: 'יש להזין את פרטי האירוע' })
  }

  const config = useRuntimeConfig() as Record<string, string>

  // The web AI model is required and explicitly configured (no hardcoded default) —
  // it is intentionally a stronger model than the wa-bot's (which uses OPENAI_MODEL).
  // Without a fallback here, an empty value would otherwise let the extractor silently
  // drop back to its own default model, so guard explicitly.
  const model = (process.env.OPENAI_MODEL_WEB || '').trim()
  if (!model) {
    console.error('[publisher/event/ai-generate] OPENAI_MODEL_WEB is not configured')
    throw createError({ statusCode: 503, message: 'שירות ה-AI אינו מוגדר כראוי' })
  }

  const { formattedEvent, flags, errorReason } = await extractEventFromFreeText(
    text,
    getCategoriesList(),
    CITIES_LIST,
    {
      openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
      openaiModel: model,
      extraInstructions: WEB_EXTRA_INSTRUCTIONS,
    },
  )

  if (errorReason || !formattedEvent) {
    if (errorReason === 'empty_input') {
      throw createError({ statusCode: 400, message: 'יש להזין את פרטי האירוע' })
    }
    console.error('[publisher/event/ai-generate] extraction failed:', errorReason)
    throw createError({ statusCode: 503, message: 'שירות ה-AI אינו זמין כעת, נסו שוב מאוחר יותר' })
  }

  const loc = formattedEvent.location || {}

  // The extractor normalizes occurrence times to UTC ISO; the form works in
  // Israel-local HH:MM, so convert back here (keeps timezone logic server-side).
  const occurrences = (formattedEvent.occurrences || []).map((o: Record<string, any>) => ({
    date: getDateInIsraelFromIso(o.startTime) || o.date || '',
    hasTime: o.hasTime === true,
    startTime: o.hasTime ? getTimeInIsraelFromIso(o.startTime) : '',
    endTime: o.endTime ? getTimeInIsraelFromIso(o.endTime) : '',
  }))

  return {
    title: formattedEvent.Title || '',
    shortDescription: formattedEvent.shortDescription || '',
    fullDescription: formattedEvent.fullDescription || '',
    mainCategory: formattedEvent.mainCategory || '',
    categories: Array.isArray(formattedEvent.categories) ? formattedEvent.categories : [],
    location: {
      city: loc.city || '',
      cityType: loc.cityType || '',
      region: loc.region || '',
      locationName: loc.locationName || '',
      addressLine1: loc.addressLine1 || '',
      locationDetails: loc.locationDetails || '',
      wazeNavLink: loc.wazeNavLink || '',
      gmapsNavLink: loc.gmapsNavLink || '',
    },
    occurrences,
    price: typeof formattedEvent.price === 'number' ? formattedEvent.price : null,
    urls: Array.isArray(formattedEvent.urls) ? formattedEvent.urls : [],
    flags: Array.isArray(flags) ? flags : [],
  }
})

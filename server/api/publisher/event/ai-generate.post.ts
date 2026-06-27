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

// The appealing-description style and live-music categorization now live in the SHARED base prompt
// (packages/event-format/freeLanguageExtract.js), so the crawler gets them too. The extraInstructions
// hook on extractEventFromFreeText remains available for any future web-only refinement.

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

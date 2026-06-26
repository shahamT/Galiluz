import { normalizePublisherFormattedEvent, validatePublisherFormattedEvent } from '~/server/utils/eventValidation'
import { stripHtml, sanitizeHtml, safeUrl } from '~/server/utils/sanitizeEventFields'
import { EVENT_CATEGORIES } from '~/consts/events.const.js'
import { CITIES } from '~/consts/regions.const.js'

const VALID_CATEGORY_IDS = Object.keys(EVENT_CATEGORIES)

function resolveCityType(loc: Record<string, any>): 'listed' | 'custom' | undefined {
  if (loc.cityType === 'listed' || loc.cityType === 'custom') return loc.cityType
  const city = String(loc.city || '')
  if (!city) return undefined
  return (CITIES as Record<string, unknown>)[city] ? 'listed' : 'custom'
}

export interface CrawlerDraftResult {
  eventObj: Record<string, unknown>
  validDraft: boolean
}

/**
 * Map a `@galiluz/event-format` formattedEvent into the stored event shape (same
 * as the publisher portal create path), sanitizing text/links. Occurrences are
 * already canonical UTC ISO from the extractor. Unlike the portal create, this
 * NEVER rejects on validation failure — it records `validDraft` so the publisher
 * can complete missing fields later.
 */
export function buildCrawlerDraftEvent(
  formattedEvent: Record<string, any>,
  publisherId: string,
  media: unknown[] = [],
  publisherPhone = '',
  accountId = '',
): CrawlerDraftResult {
  const loc = formattedEvent.location || {}

  const eventObj: Record<string, unknown> = {
    Title: stripHtml(formattedEvent.Title),
    shortDescription: stripHtml(formattedEvent.shortDescription),
    fullDescription: sanitizeHtml(formattedEvent.fullDescription),
    mainCategory: String(formattedEvent.mainCategory || ''),
    categories: Array.isArray(formattedEvent.categories)
      ? formattedEvent.categories.filter((c: unknown) => typeof c === 'string')
      : [],
    multiDayEvent: true,
    occurrences: Array.isArray(formattedEvent.occurrences) ? formattedEvent.occurrences : [],
    location: {
      city: stripHtml(loc.city),
      cityType: resolveCityType(loc),
      region: typeof loc.region === 'string' && loc.region.trim() ? loc.region.trim() : undefined,
      locationName: stripHtml(loc.locationName),
      addressLine1: stripHtml(loc.addressLine1),
      locationDetails: stripHtml(loc.locationDetails),
      wazeNavLink: safeUrl(loc.wazeNavLink),
      gmapsNavLink: safeUrl(loc.gmapsNavLink),
    },
    price: typeof formattedEvent.price === 'number' ? formattedEvent.price : null,
    urls: Array.isArray(formattedEvent.urls)
      ? formattedEvent.urls
          .map((u: Record<string, any>) => ({
            Title: stripHtml(u.Title),
            Url: u.type === 'phone' ? String(u.Url ?? '').trim() : (safeUrl(u.Url) ?? ''),
            type: u.type === 'phone' ? 'phone' : 'link',
          }))
          .filter((u: { Url: string }) => u.Url)
      : [],
    media: Array.isArray(media) ? media : [],
    accountId,
    publisherId,
    originalCreatorPublisherId: publisherId,
    showContactPhone: true,
    customContactPhone: '',
    publisherPhone,
  }

  normalizePublisherFormattedEvent(eventObj, VALID_CATEGORY_IDS)
  const validation = validatePublisherFormattedEvent(eventObj)
  return { eventObj, validDraft: validation.valid }
}

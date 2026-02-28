/**
 * OpenAI JSON schema for publisher event formatting (wa-bot flow).
 * AI returns: shortDescription, categories, occurrences, city, price, urls, and flags (always; may be empty).
 * Only these field keys may appear in flags: rawTitle, rawOccurrences, rawCity, rawLocation, rawNavLinks, rawPrice, rawFullDescription, rawUrls, rawMainCategory.
 */
const FLAG_FIELD_KEYS = [
  'rawTitle',
  'rawOccurrences',
  'rawCity',
  'rawLocation',
  'rawNavLinks',
  'rawPrice',
  'rawFullDescription',
  'rawUrls',
  'rawMainCategory',
]

/**
 * Build publisher event format schema with categories enum from valid category IDs.
 * @param {Array<{id: string, label: string}>} categoriesList
 * @returns {object} JSON schema for OpenAI response_format
 */
export function buildPublisherEventSchema(categoriesList) {
  const validCategoryIds = Array.isArray(categoriesList)
    ? categoriesList.map((c) => c.id).filter((id) => typeof id === 'string' && id.trim())
    : []
  return {
    name: 'publisher_event_format',
    strict: true,
    schema: {
      type: 'object',
      required: ['shortDescription', 'categories', 'occurrences', 'city', 'price', 'urls', 'flags'],
      additionalProperties: false,
      properties: {
        shortDescription: { type: 'string' },
        categories: {
          type: 'array',
          items: validCategoryIds.length > 0 ? { type: 'string', enum: validCategoryIds } : { type: 'string' },
          minItems: 1,
        },
        occurrences: {
          type: 'array',
          minItems: 1,
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
        city: { type: 'string' },
        price: { type: ['number', 'null'] },
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
              fieldKey: { type: 'string', enum: FLAG_FIELD_KEYS },
              reason: { type: 'string' },
            },
          },
        },
      },
    }
  }
}

/** @deprecated Use buildPublisherEventSchema(categoriesList) for schema with categories enum */
export const PUBLISHER_EVENT_FORMAT_SCHEMA = buildPublisherEventSchema([])

export const ALLOWED_FLAG_FIELD_KEYS = new Set(FLAG_FIELD_KEYS)

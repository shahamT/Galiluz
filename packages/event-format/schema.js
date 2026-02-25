/**
 * OpenAI JSON schema for publisher event formatting (wa-bot flow).
 * AI returns: shortDescription, categories, occurrences, city, price, urls.
 */
export const PUBLISHER_EVENT_FORMAT_SCHEMA = {
  name: 'publisher_event_format',
  strict: true,
  schema: {
    type: 'object',
    required: ['shortDescription', 'categories', 'occurrences', 'city', 'price', 'urls'],
    additionalProperties: false,
    properties: {
      shortDescription: { type: 'string' },
      categories: {
        type: 'array',
        items: { type: 'string' },
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
          required: ['Title', 'Url'],
          additionalProperties: false,
          properties: {
            Title: { type: 'string' },
            Url: { type: 'string' },
            type: { type: 'string', enum: ['link', 'phone'] },
          },
        },
      },
    },
  },
}

/**
 * OpenAI JSON schema for publisher event formatting (wa-bot flow).
 * AI returns only: shortDescription, categories, occurrences, city, price.
 * Occurrence shape matches wa-listener / eventsTransform for compatibility.
 */
export const PUBLISHER_EVENT_FORMAT_SCHEMA = {
  name: 'publisher_event_format',
  strict: true,
  schema: {
    type: 'object',
    required: ['shortDescription', 'categories', 'occurrences', 'city', 'price'],
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
    },
  },
} as const

/**
 * OpenAI JSON schemas for structured outputs (event classification, extraction, comparison).
 * Used with response_format.json_schema in chat completions.
 */

export const CLASSIFICATION_SCHEMA = {
  name: 'classification',
  strict: true,
  schema: {
    type: 'object',
    required: ['isEvent', 'searchKeys', 'reason'],
    additionalProperties: false,
    properties: {
      isEvent: { type: 'boolean' },
      searchKeys: { type: 'array', items: { type: 'string' } },
      reason: { type: ['string', 'null'] },
    },
  },
}

export const EVENT_SCHEMA_PROPERTIES = {
  media: { type: 'array', items: { type: 'string' } },
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
  categories: { type: 'array', items: { type: 'string' } },
  mainCategory: { type: 'string' },
  Title: { type: 'string' },
  fullDescription: { type: 'string' },
  shortDescription: { type: 'string' },
  location: {
    type: 'object',
    required: ['City', 'CityEvidence', 'addressLine1', 'addressLine2', 'locationDetails', 'wazeNavLink', 'gmapsNavLink'],
    additionalProperties: false,
    properties: {
      City: { type: 'string' },
      CityEvidence: { type: ['string', 'null'] },
      addressLine1: { type: ['string', 'null'] },
      addressLine2: { type: ['string', 'null'] },
      locationDetails: { type: ['string', 'null'] },
      wazeNavLink: { type: ['string', 'null'] },
      gmapsNavLink: { type: ['string', 'null'] },
    },
  },
  price: { type: ['number', 'null'] },
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
  justifications: {
    type: 'object',
    required: ['date', 'location', 'startTime', 'endTime', 'price'],
    additionalProperties: false,
    properties: {
      date: { type: 'string' },
      location: { type: 'string' },
      startTime: { type: 'string' },
      endTime: { type: 'string' },
      price: { type: 'string' },
    },
  },
}

export const EXTRACTION_SCHEMA = {
  name: 'event_extraction',
  strict: true,
  schema: {
    type: 'object',
    required: Object.keys(EVENT_SCHEMA_PROPERTIES),
    additionalProperties: false,
    properties: EVENT_SCHEMA_PROPERTIES,
  },
}

export const COMPARISON_SCHEMA = {
  name: 'comparison',
  strict: true,
  schema: {
    type: 'object',
    required: ['status', 'matchedCandidateId', 'reason'],
    additionalProperties: false,
    properties: {
      status: { type: 'string', enum: ['new_event', 'existing_event', 'updated_event'] },
      matchedCandidateId: { type: ['string', 'null'] },
      reason: { type: 'string' },
    },
  },
}

const EVIDENCE_CANDIDATE_ITEM = {
  type: 'object',
  required: ['quote', 'source', 'messageTextStartIdx', 'messageTextEndIdx', 'ocrBlockId', 'ocrLineId', 'fieldSubtype'],
  additionalProperties: false,
  properties: {
    quote: { type: 'string' },
    source: { type: 'string', enum: ['message_text', 'ocr_text', 'url'] },
    messageTextStartIdx: { type: ['integer', 'null'] },
    messageTextEndIdx: { type: ['integer', 'null'] },
    ocrBlockId: { type: ['string', 'null'] },
    ocrLineId: { type: ['string', 'null'] },
    fieldSubtype: { type: ['string', 'null'] },
  },
}

export const EVIDENCE_LOCATOR_SCHEMA = {
  name: 'evidence_locator',
  strict: true,
  schema: {
    type: 'object',
    required: ['evidenceCandidates'],
    additionalProperties: false,
    properties: {
      evidenceCandidates: {
        type: 'object',
        required: ['date', 'timeOfDay', 'location', 'price'],
        additionalProperties: false,
        properties: {
          date: { type: 'array', items: EVIDENCE_CANDIDATE_ITEM },
          timeOfDay: { type: 'array', items: EVIDENCE_CANDIDATE_ITEM },
          location: { type: 'array', items: EVIDENCE_CANDIDATE_ITEM },
          price: { type: 'array', items: EVIDENCE_CANDIDATE_ITEM },
        },
      },
    },
  },
}

export const DESCRIPTION_BUILDER_SCHEMA = {
  name: 'description_builder',
  strict: true,
  schema: {
    type: 'object',
    required: ['Title', 'shortDescription', 'fullDescription', 'categories', 'mainCategory', 'urls'],
    additionalProperties: false,
    properties: {
      Title: { type: 'string' },
      shortDescription: { type: 'string' },
      fullDescription: { type: 'string' },
      categories: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
      mainCategory: { type: 'string' },
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
    },
  },
}

const FIELD_VERIFICATION_ITEM = {
  type: 'object',
  required: ['fieldName', 'ok', 'reason'],
  additionalProperties: false,
  properties: {
    fieldName: { type: 'string' },
    ok: { type: 'boolean' },
    suggestedValue: { type: ['string', 'null'] },
    reason: { type: 'string' },
  },
}

export const FIELD_VERIFICATION_SCHEMA = {
  name: 'field_verification',
  strict: true,
  schema: {
    type: 'object',
    required: ['fields'],
    additionalProperties: false,
    properties: {
      fields: {
        type: 'array',
        items: FIELD_VERIFICATION_ITEM,
      },
    },
  },
}

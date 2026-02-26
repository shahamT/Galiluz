/**
 * Event-add flow: field key → ask/validate/state for flag flow (re-ask when AI raises flags).
 * Only fields the AI is allowed to flag are included (no category, location name, address, location details, media).
 */
import {
  EVENT_ADD_ASK_TITLE,
  EVENT_ADD_ASK_DATETIME,
  EVENT_ADD_ASK_DATETIME_FOOTER,
  EVENT_ADD_ASK_PLACE_NAME,
  EVENT_ADD_ASK_ADDRESS,
  EVENT_ADD_ASK_ADDRESS_FOOTER,
  EVENT_ADD_SKIP_BUTTON,
  EVENT_ADD_ASK_CITY,
  EVENT_ADD_ASK_WAZE_GMAPS,
  EVENT_ADD_ASK_PRICE,
  EVENT_ADD_ASK_PRICE_FOOTER,
  EVENT_ADD_ASK_DESCRIPTION,
  EVENT_ADD_ASK_LINKS,
  EVENT_ADD_ASK_LINKS_FOOTER,
  EVENT_ADD_ASK_MAIN_CATEGORY,
  EVENT_ADD_VALIDATE_TITLE,
  EVENT_ADD_VALIDATE_DATETIME,
  EVENT_ADD_VALIDATE_PLACE_NAME,
  EVENT_ADD_VALIDATE_ADDRESS,
  EVENT_ADD_VALIDATE_MAIN_CATEGORY,
  EVENT_ADD_VALIDATE_CITY,
  EVENT_ADD_VALIDATE_WAZE_GMAPS,
  EVENT_ADD_VALIDATE_PRICE,
  EVENT_ADD_VALIDATE_DESCRIPTION,
  EVENT_ADD_VALIDATE_LINKS,
  EVENT_ADD_TITLE_MIN,
  EVENT_ADD_TITLE_MAX,
  EVENT_ADD_DATETIME_MAX,
  EVENT_ADD_CITY_MAX,
  EVENT_ADD_WAZE_GMAPS_MAX,
  EVENT_ADD_PRICE_MAX,
  EVENT_ADD_DESCRIPTION_MIN,
  EVENT_ADD_DESCRIPTION_MAX,
  EVENT_ADD_LINKS_MAX,
  EVENT_ADD_PLACE_NAME_MAX,
  EVENT_ADD_ADDRESS_MAX,
} from './index.js'

/** Canonical order of flaggable field keys (only those the AI may flag). */
export const FLAG_FIELD_ORDER = [
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
 * @typedef {'text' | 'text_skip' | 'list' | 'compound_category'} FlagInputType
 * text = required text, text_skip = text or skip button, list = interactive list (category)
 * compound_category = group choice then category choice (same as regular add flow)
 */

/**
 * @typedef {object} FlagFieldConfig
 * @property {string} label - Hebrew label for flags message (bold line)
 * @property {string[]} stateKeys - state keys to set (e.g. ['eventAddTitle'] or ['eventAddAddressLine1','eventAddAddressLine2'])
 * @property {string} ask - prompt body
 * @property {string} [footer] - optional footer for interactive (≤60 chars)
 * @property {string} validate - validation error message
 * @property {FlagInputType} inputType
 * @property {{ min?: number, max?: number }} [lengthLimits] - for validation
 */

/** @type {Record<string, FlagFieldConfig>} */
export const FLAG_FIELD_CONFIGS = {
  rawTitle: {
    label: 'שם האירוע',
    stateKeys: ['eventAddTitle'],
    ask: EVENT_ADD_ASK_TITLE,
    validate: EVENT_ADD_VALIDATE_TITLE,
    inputType: 'text',
    lengthLimits: { min: EVENT_ADD_TITLE_MIN, max: EVENT_ADD_TITLE_MAX },
  },
  rawOccurrences: {
    label: 'תאריך ושעה',
    stateKeys: ['eventAddDateTime'],
    ask: EVENT_ADD_ASK_DATETIME,
    footer: EVENT_ADD_ASK_DATETIME_FOOTER,
    validate: EVENT_ADD_VALIDATE_DATETIME,
    inputType: 'text',
    lengthLimits: { max: EVENT_ADD_DATETIME_MAX },
  },
  rawCity: {
    label: 'יישוב',
    stateKeys: ['eventAddCity'],
    ask: EVENT_ADD_ASK_CITY,
    footer: 'ניתן לדלג ולבחור אזור בלחיצה',
    validate: EVENT_ADD_VALIDATE_CITY,
    inputType: 'text_skip',
    lengthLimits: { max: EVENT_ADD_CITY_MAX },
  },
  /** Compound: place name (can skip) then address (required if place skipped, can skip if place filled). */
  rawLocation: {
    label: 'מיקום',
    stateKeys: ['eventAddPlaceName', 'eventAddAddressLine1', 'eventAddAddressLine2'],
    ask: EVENT_ADD_ASK_PLACE_NAME,
    askAddress: EVENT_ADD_ASK_ADDRESS,
    footerAddress: EVENT_ADD_ASK_ADDRESS_FOOTER,
    validate: EVENT_ADD_VALIDATE_PLACE_NAME,
    validateAddress: EVENT_ADD_VALIDATE_ADDRESS,
    inputType: 'compound_location',
    skipButton: EVENT_ADD_SKIP_BUTTON,
    lengthLimits: { max: EVENT_ADD_PLACE_NAME_MAX },
    lengthLimitsAddress: { max: EVENT_ADD_ADDRESS_MAX },
  },
  rawNavLinks: {
    label: 'לינקי ניווט',
    stateKeys: ['eventAddNavLinks'],
    ask: EVENT_ADD_ASK_WAZE_GMAPS,
    validate: EVENT_ADD_VALIDATE_WAZE_GMAPS,
    inputType: 'text_skip',
    lengthLimits: { max: EVENT_ADD_WAZE_GMAPS_MAX },
  },
  rawPrice: {
    label: 'מחיר',
    stateKeys: ['eventAddPrice'],
    ask: EVENT_ADD_ASK_PRICE,
    footer: EVENT_ADD_ASK_PRICE_FOOTER,
    validate: EVENT_ADD_VALIDATE_PRICE,
    inputType: 'text',
    lengthLimits: { max: EVENT_ADD_PRICE_MAX },
  },
  rawFullDescription: {
    label: 'תיאור',
    stateKeys: ['eventAddDescription'],
    ask: EVENT_ADD_ASK_DESCRIPTION,
    validate: EVENT_ADD_VALIDATE_DESCRIPTION,
    inputType: 'text',
    lengthLimits: { min: EVENT_ADD_DESCRIPTION_MIN, max: EVENT_ADD_DESCRIPTION_MAX },
  },
  rawUrls: {
    label: 'לינקים',
    stateKeys: ['eventAddLinks'],
    ask: EVENT_ADD_ASK_LINKS,
    footer: EVENT_ADD_ASK_LINKS_FOOTER,
    validate: EVENT_ADD_VALIDATE_LINKS,
    inputType: 'text_skip',
    lengthLimits: { max: EVENT_ADD_LINKS_MAX },
  },
  rawMainCategory: {
    label: 'קטגוריה',
    stateKeys: ['eventAddMainCategory'],
    ask: EVENT_ADD_ASK_MAIN_CATEGORY,
    validate: EVENT_ADD_VALIDATE_MAIN_CATEGORY,
    inputType: 'compound_category',
    lengthLimits: {},
  },
}

/**
 * Return deduplicated, canonically ordered list of field keys from flags.
 * @param {Array<{ fieldKey: string, reason: string }>} flags
 * @returns {string[]}
 */
export function getFlagFieldOrder(flags) {
  if (!Array.isArray(flags) || flags.length === 0) return []
  const fromFlags = new Set(flags.filter((f) => f && f.fieldKey).map((f) => f.fieldKey))
  return FLAG_FIELD_ORDER.filter((key) => fromFlags.has(key))
}

/**
 * Event-add flow: field key → ask/validate/state for flag flow (re-ask when AI raises flags).
 * Only fields the AI is allowed to flag are included (no category, location name, address, location details, media).
 */
import { EVENT_ADD, VALIDATION } from './index.js'

/** Canonical order of flaggable field keys (only those the AI may flag). rawRegion is injected when custom city. rawCityOutsideNorth same as rawCity. */
export const FLAG_FIELD_ORDER = [
  'rawTitle',
  'rawOccurrences',
  'rawCity',
  'rawCityOutsideNorth',
  'rawRegion',
  'rawLocation',
  'rawNavLinks',
  'rawPrice',
  'rawFullDescription',
  'rawUrls',
  'rawMainCategory',
]

/**
 * @typedef {'text' | 'text_skip' | 'list' | 'compound_category' | 'region_buttons'} FlagInputType
 * text = required text, text_skip = text or skip button, list = interactive list (category)
 * compound_category = group choice then category choice (same as regular add flow)
 * region_buttons = region map + buttons (for custom city)
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
    ask: EVENT_ADD.ASK_TITLE,
    validate: VALIDATION.VALIDATE_TITLE,
    inputType: 'text',
    lengthLimits: { min: VALIDATION.TITLE_MIN, max: VALIDATION.TITLE_MAX },
  },
  rawOccurrences: {
    label: 'תאריך ושעה',
    stateKeys: ['eventAddDateTime'],
    ask: EVENT_ADD.ASK_DATETIME,
    footer: EVENT_ADD.ASK_DATETIME_FOOTER,
    validate: VALIDATION.VALIDATE_DATETIME,
    inputType: 'text',
    lengthLimits: { max: VALIDATION.DATETIME_MAX },
  },
  rawCity: {
    label: 'יישוב',
    stateKeys: ['eventAddCity'],
    ask: EVENT_ADD.ASK_CITY,
    validate: VALIDATION.VALIDATE_CITY,
    inputType: 'text_skip',
    lengthLimits: { max: VALIDATION.CITY_MAX },
  },
  rawCityOutsideNorth: {
    label: 'יישוב',
    stateKeys: ['eventAddCity'],
    ask: EVENT_ADD.ASK_CITY,
    validate: VALIDATION.VALIDATE_CITY,
    inputType: 'text_skip',
    lengthLimits: { max: VALIDATION.CITY_MAX },
  },
  rawRegion: {
    label: 'אזור',
    stateKeys: ['eventAddRegion'],
    ask: EVENT_ADD.ASK_REGION,
    validate: VALIDATION.VALIDATE_REGION,
    inputType: 'region_buttons',
  },
  /** Compound: place name (can skip) then city (required if place skipped, can skip if place filled). */
  rawLocation: {
    label: 'מיקום',
    stateKeys: ['eventAddPlaceName', 'eventAddCity'],
    ask: EVENT_ADD.ASK_PLACE_NAME,
    askCity: EVENT_ADD.ASK_CITY,
    validate: VALIDATION.VALIDATE_PLACE_NAME,
    validateCity: VALIDATION.VALIDATE_CITY,
    inputType: 'compound_location',
    skipButton: EVENT_ADD.SKIP_BUTTON,
    lengthLimits: { max: VALIDATION.PLACE_NAME_MAX },
    lengthLimitsCity: { max: VALIDATION.CITY_MAX },
  },
  rawNavLinks: {
    label: 'לינקי ניווט',
    stateKeys: ['eventAddNavLinks'],
    ask: EVENT_ADD.ASK_WAZE_GMAPS,
    validate: VALIDATION.VALIDATE_WAZE_GMAPS,
    inputType: 'text_skip',
    lengthLimits: { max: VALIDATION.WAZE_GMAPS_MAX },
  },
  rawPrice: {
    label: 'מחיר',
    stateKeys: ['eventAddPrice'],
    ask: EVENT_ADD.ASK_PRICE,
    footer: EVENT_ADD.ASK_PRICE_FOOTER,
    validate: VALIDATION.VALIDATE_PRICE,
    inputType: 'text',
    lengthLimits: { max: VALIDATION.PRICE_MAX },
  },
  rawFullDescription: {
    label: 'תיאור',
    stateKeys: ['eventAddDescription'],
    ask: EVENT_ADD.ASK_DESCRIPTION,
    validate: VALIDATION.VALIDATE_DESCRIPTION,
    inputType: 'text',
    lengthLimits: { min: VALIDATION.DESCRIPTION_MIN, max: VALIDATION.DESCRIPTION_MAX },
  },
  rawUrls: {
    label: 'לינקים',
    stateKeys: ['eventAddLinks'],
    ask: EVENT_ADD.ASK_LINKS,
    footer: EVENT_ADD.ASK_LINKS_FOOTER,
    validate: VALIDATION.VALIDATE_LINKS,
    inputType: 'text_skip',
    lengthLimits: { max: VALIDATION.LINKS_MAX },
  },
  rawMainCategory: {
    label: 'קטגוריה',
    stateKeys: ['eventAddMainCategory'],
    ask: EVENT_ADD.ASK_MAIN_CATEGORY,
    validate: VALIDATION.VALIDATE_MAIN_CATEGORY,
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

/**
 * Event-add flow: multi-step form for approved publishers.
 * Handles timeout, cancel (ביטול / back), validation, media upload, and submit.
 */
import {
  sendText,
  sendInteractiveButtons,
  sendInteractiveList,
  downloadMedia,
} from '../services/cloudApi.service.js'
import { uploadMediaToApp, deleteMediaOnApp } from '../services/eventAddMedia.service.js'
import { createDraft, processDraft, activateEvent } from '../services/eventsCreate.service.js'
import { createEvent } from '../services/eventsCreate.service.js'
import { patchDraft } from '../services/eventDraftPatch.service.js'
import { conversationState } from '../services/conversationState.service.js'
import { config, normalizePhone } from '../config.js'
import { generateShortDescription, normalizeCityForEdit, extractNavLinksFromRaw } from 'event-format'
import { getDateInIsraelFromIso, getTimeInIsraelFromIso } from '../utils/date.helpers.js'
import { logger } from '../utils/logger.js'
import {
  EVENT_ADD_INITIAL,
  EVENT_ADD_ASK_TITLE,
  EVENT_ADD_ASK_DATETIME,
  EVENT_ADD_ASK_DATETIME_FOOTER,
  EVENT_ADD_CATEGORY_INTRO,
  EVENT_ADD_ASK_CATEGORY_GROUP,
  EVENT_ADD_ASK_MAIN_CATEGORY,
  EVENT_ADD_CATEGORY_FOOTER,
  EVENT_ADD_CHANGE_GROUP_BUTTON,
  EVENT_ADD_CHANGE_GROUP_ROW_TITLE,
  EVENT_ADD_LOCATION_INTRO,
  EVENT_ADD_ASK_PLACE_NAME,
  EVENT_ADD_SKIP_BUTTON,
  EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON,
  EVENT_ADD_ASK_CITY,
  EVENT_ADD_ASK_ADDRESS,
  EVENT_ADD_ASK_ADDRESS_FOOTER,
  EVENT_ADD_ASK_LOCATION_NOTES,
  EVENT_ADD_ASK_LOCATION_NOTES_FOOTER,
  EVENT_ADD_ASK_WAZE_GMAPS,
  EVENT_ADD_ASK_PRICE,
  EVENT_ADD_ASK_PRICE_FOOTER,
  EVENT_ADD_ASK_DESCRIPTION,
  EVENT_ADD_ASK_LINKS,
  EVENT_ADD_ASK_LINKS_FOOTER,
  EVENT_ADD_ASK_MEDIA_FIRST,
  EVENT_ADD_ASK_MEDIA_MORE,
  EVENT_ADD_PROCESSING_MESSAGE,
  EVENT_ADD_SUCCESS,
  EVENT_ADD_TITLE_MIN,
  EVENT_ADD_TITLE_MAX,
  EVENT_ADD_DATETIME_MAX,
  EVENT_ADD_PLACE_NAME_MAX,
  EVENT_ADD_CITY_MAX,
  EVENT_ADD_ADDRESS_MAX,
  EVENT_ADD_LOCATION_NOTES_MAX,
  EVENT_ADD_WAZE_GMAPS_MAX,
  EVENT_ADD_PRICE_MAX,
  EVENT_ADD_DESCRIPTION_MIN,
  EVENT_ADD_DESCRIPTION_MAX,
  EVENT_ADD_LINKS_MAX,
  EVENT_ADD_VALIDATE_TITLE,
  EVENT_ADD_VALIDATE_DATETIME,
  EVENT_ADD_VALIDATE_MAIN_CATEGORY_GROUP,
  EVENT_ADD_VALIDATE_MAIN_CATEGORY,
  EVENT_ADD_VALIDATE_PLACE_NAME,
  EVENT_ADD_VALIDATE_CITY,
  EVENT_ADD_VALIDATE_ADDRESS,
  EVENT_ADD_VALIDATE_LOCATION_NOTES,
  EVENT_ADD_VALIDATE_WAZE_GMAPS,
  EVENT_ADD_VALIDATE_PRICE,
  EVENT_ADD_VALIDATE_DESCRIPTION,
  EVENT_ADD_VALIDATE_LINKS,
  EVENT_ADD_VALIDATE_MEDIA,
  EVENT_ADD_MEDIA_UPLOAD_FAILED,
  EVENT_ADD_CONFIRM_INTRO,
  EVENT_ADD_SUCCESS_HEADING,
  EVENT_ADD_SUCCESS_BODY,
  EVENT_ADD_SUCCESS_VIEW_PROMPT,
  EVENT_ADD_SUCCESS_ADD_AGAIN_BUTTON,
  EVENT_ADD_SUCCESS_MAIN_MENU_BUTTON,
  EVENT_ADD_CONFIRM_SAVE_BUTTON,
  EVENT_ADD_CONFIRM_EDIT_BUTTON,
  EVENT_ADD_CONFIRM_EDIT_RESTART,
  EVENT_EDIT_ASK_TITLE,
  EVENT_EDIT_ASK_DESCRIPTION,
  EVENT_EDIT_SUCCESS_MESSAGES,
  EVENT_EDIT_SUCCESS_DONE_BUTTON,
  EVENT_EDIT_SUCCESS_MORE_BUTTON,
  EVENT_EDIT_SUCCESS_CHOOSE_BODY,
  EVENT_EDIT_PATCH_ERROR,
  EVENT_EDIT_EXTRA_CANNOT_REMOVE_LAST,
  EVENT_EDIT_LOCATION_CITY_UNRECOGNIZED,
  EVENT_ADD_MAX_CATEGORIES,
  EVENT_EDIT_EXTRA_CATEGORIES_BODY,
  EVENT_EDIT_EXTRA_CATEGORIES_NO_EXTRAS,
  EVENT_EDIT_EXTRA_ADD_BUTTON,
  EVENT_EDIT_EXTRA_REMOVE_BUTTON,
  EVENT_EDIT_EXTRA_BACK_BUTTON,
  EVENT_EDIT_EXTRA_MAX_REACHED,
  EVENT_EDIT_EXTRA_REMOVE_ASK,
  EVENT_EDIT_EXTRA_NO_REMOVE,
  EVENT_EDIT_LOCATION_MENU_BODY,
  EVENT_EDIT_LOCATION_MENU_FOOTER,
  EVENT_EDIT_LOCATION_BACK_ROW,
  EVENT_EDIT_LOCATION_DONE_ROW,
  EVENT_EDIT_LOCATION_FIELD_ROWS,
  EVENT_EDIT_LOCATION_ASK_PLACE_NAME,
  EVENT_EDIT_LOCATION_ASK_CITY,
  EVENT_EDIT_LOCATION_ASK_ADDRESS,
  EVENT_EDIT_LOCATION_ASK_DETAILS,
  EVENT_EDIT_LOCATION_ASK_GMAPS,
  EVENT_EDIT_LOCATION_ASK_WAZE,
  EVENT_ADD_FORMAT_FAILED,
  EVENT_ADD_FORMAT_FAILED_RETRY_BODY,
  EVENT_ADD_FORMAT_RETRY_BUTTON,
  EVENT_ADD_FLAGS_INTRO,
  EVENT_ADD_FLAGS_FILL_AGAIN,
  LOG_PREFIXES,
} from '../consts/index.js'
import { WELCOME_INTERACTIVE } from '../consts/index.js'
import { getFlagFieldOrder, FLAG_FIELD_CONFIGS } from '../consts/eventAddFields.config.js'
import { buildEditMenuListPayload, buildLocationEditMenuPayload, EDIT_DONE_ID } from './eventEditFlow.js'
import { CATEGORY_GROUPS, EVENT_CATEGORIES } from '../consts/categories.const.js'

const VALID_CATEGORY_IDS = new Set(Object.keys(EVENT_CATEGORIES))
const VALID_GROUP_IDS = new Set(CATEGORY_GROUPS.map((g) => g.id))

/** Map from location edit list row id to { key: location field key, ask: prompt string }. */
const LOCATION_FIELD_MAP = {
  loc_place_name: { key: 'locationName', ask: EVENT_EDIT_LOCATION_ASK_PLACE_NAME },
  loc_city: { key: 'City', ask: EVENT_EDIT_LOCATION_ASK_CITY },
  loc_address: { key: 'addressLine1', ask: EVENT_EDIT_LOCATION_ASK_ADDRESS },
  loc_details: { key: 'locationDetails', ask: EVENT_EDIT_LOCATION_ASK_DETAILS },
  loc_gmaps: { key: 'gmapsNavLink', ask: EVENT_EDIT_LOCATION_ASK_GMAPS },
  loc_waze: { key: 'wazeNavLink', ask: EVENT_EDIT_LOCATION_ASK_WAZE },
}

const STEPS = conversationState.STEPS
const MAX_MEDIA = 6
const EVENT_ADD_TIMEOUT_MS = 30 * 60 * 1000

const EVENT_ADD_STEPS = [
  STEPS.EVENT_ADD_INITIAL,
  STEPS.EVENT_ADD_TITLE,
  STEPS.EVENT_ADD_DATETIME,
  STEPS.EVENT_ADD_MAIN_CATEGORY_GROUP,
  STEPS.EVENT_ADD_MAIN_CATEGORY,
  STEPS.EVENT_ADD_PLACE_NAME,
  STEPS.EVENT_ADD_CITY,
  STEPS.EVENT_ADD_ADDRESS,
  STEPS.EVENT_ADD_LOCATION_NOTES,
  STEPS.EVENT_ADD_WAZE_GMAPS,
  STEPS.EVENT_ADD_PRICE,
  STEPS.EVENT_ADD_DESCRIPTION,
  STEPS.EVENT_ADD_LINKS,
  STEPS.EVENT_ADD_MEDIA,
  STEPS.EVENT_ADD_MEDIA_MORE,
  STEPS.EVENT_ADD_FLAGS_REVIEW,
  STEPS.EVENT_ADD_FLAG_INPUT,
  STEPS.EVENT_ADD_CONFIRM,
  STEPS.EVENT_ADD_EDIT_MENU,
  STEPS.EVENT_ADD_EDIT_FIELD,
  STEPS.EVENT_ADD_EDIT_MAIN_CATEGORY_GROUP,
  STEPS.EVENT_ADD_EDIT_MAIN_CATEGORY,
  STEPS.EVENT_ADD_EDIT_SUCCESS,
  STEPS.EVENT_ADD_EDIT_EXTRA_CATEGORIES,
  STEPS.EVENT_ADD_EDIT_EXTRA_ADD_GROUP,
  STEPS.EVENT_ADD_EDIT_EXTRA_ADD_CATEGORY,
  STEPS.EVENT_ADD_EDIT_EXTRA_REMOVE,
  STEPS.EVENT_ADD_EDIT_LOCATION_MENU,
  STEPS.EVENT_ADD_EDIT_LOCATION_FIELD,
]

function isEventAddStep(step) {
  return EVENT_ADD_STEPS.includes(step)
}

function buildMediaCountMessage(mediaCount) {
  return `_${mediaCount}/${MAX_MEDIA} קבצים נטענו_`
}

/** Body for "עוד X תמונות/סרטונים" with button. remaining = MAX_MEDIA - mediaCount. */
function buildMediaMoreBody(remaining) {
  if (remaining <= 1) return 'ניתן לשלוח עוד תמונה/סרטון אחד'
  return `ניתן לשלוח עוד ${remaining} תמונות/סרטונים`
}

/**
 * Send "עוד X" + finish button once if user is still in media step with < MAX_MEDIA. Called by webhook after queue drains.
 * @param {string} phoneNumberId
 * @param {string} from
 * @returns {Promise<object|void>}
 */
export function sendMediaMoreMessageIfNeeded(phoneNumberId, from) {
  const state = conversationState.get(from)
  const step = state?.step
  const media = Array.isArray(state?.eventAddMedia) ? state.eventAddMedia : []
  if (
    (step === STEPS.EVENT_ADD_MEDIA || step === STEPS.EVENT_ADD_MEDIA_MORE) &&
    media.length >= 1 &&
    media.length < MAX_MEDIA &&
    !state.eventAddConfirmPending
  ) {
    return sendInteractiveButtons(phoneNumberId, from, {
      body: buildMediaMoreBody(MAX_MEDIA - media.length),
      buttons: [EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON],
    })
  }
}

// DEV: test mode – remove when no longer needed
const EVENT_ADD_TEST_MODE_STATE = {
  eventAddTitle: 'סדנה איטלקית - מסע בדרום איטליה',
  eventAddDateTime: '5 עד ה6 במרץ משמונה עד 10 בערב',
  eventAddPlaceName: 'המטבח',
  eventAddCity: 'יסוד המאלה',
  eventAddAddressLine1: 'רודבסקי יוסף 26',
  eventAddAddressLine2: 'בניין 3',
  eventAddLocationNotes: 'בסוף המדשאה שמאלה',
  eventAddNavLinks:
    'https://maps.app.goo.gl/RSEG3NXabkaPv4hL6\n\nUse Waze to drive to קפה פילוסופ- קיבוץ הגושרים: https://waze.com/ul/hsvcm48jbn',
  eventAddPrice: '50 שח לפיצה אבל הכניסה בחינם',
  eventAddMainCategory: 'food',
  eventAddMainCategoryGroupId: 'food_art_shopping',
  eventAddExtraCategories: [],
  eventAddDescription: `איטליה
סדנה
המטבח יסוד המעלה
יום רביעי, 25.2
כל היום
מחיר לא ידוע
סדנה איטלקית - מסע בדרום איטליה
סדנה איטלקית - מסע בדרום איטליה

מה נכין בסדנה?

בצק לפסטה
פטוציני
רביולי מלא בריקוטה פרסקה
פוקצ'ות מעולות
סלטים מיוחדים
ולסיום ארוחה מדהימה בלווי יין.

ניפגש ביום רביעי 25.02 בשעה 18.30

להרשמה 0545712343

המטבח יסוד המעלה

כשר

ניתן להירשם דרך תוכנית עמית.`,
  eventAddLinks: 'להרשמה 0545712343\nלפרטים נוספים link.co.il',
}

/**
 * DEV: Apply test-mode state (fixed raw event) and send media step. Remove when no longer needed.
 * @param {string} phoneNumberId
 * @param {string} from
 * @returns {Promise<object>}
 */
function applyEventAddTestModeAndGoToMedia(phoneNumberId, from) {
  conversationState.set(from, {
    ...EVENT_ADD_TEST_MODE_STATE,
    step: STEPS.EVENT_ADD_MEDIA,
    eventAddMedia: [],
    eventAddLastActivityAt: Date.now(),
  })
  logger.info(LOG_PREFIXES.EVENT_ADD, 'Test mode: skip to media', from)
  return sendInteractiveButtons(phoneNumberId, from, {
    body: EVENT_ADD_ASK_MEDIA_FIRST,
    buttons: [EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON],
  })
}

const WHATSAPP_MESSAGE_MAX = 4096
/** WhatsApp interactive button message body max (one message with intro + preview + buttons). */
const WHATSAPP_INTERACTIVE_BODY_MAX = 1024

/**
 * Format YYYY-MM-DD as DD.MM.YYYY for display.
 * @param {string|null} yyyyMmDd
 * @returns {string}
 */
function formatDateDisplay(yyyyMmDd) {
  if (!yyyyMmDd || typeof yyyyMmDd !== 'string') return '-'
  const parts = yyyyMmDd.trim().slice(0, 10).split('-')
  if (parts.length !== 3) return yyyyMmDd
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

/** Format YYYY-MM-DD as D.M (no year) for occurrence preview. */
function formatDateDisplayNoYear(yyyyMmDd) {
  if (!yyyyMmDd || typeof yyyyMmDd !== 'string') return '-'
  const parts = yyyyMmDd.trim().slice(0, 10).split('-')
  if (parts.length !== 3) return yyyyMmDd
  return `${parts[2]}.${parts[1]}`
}

/**
 * Build formatted event preview string(s) for WhatsApp. Uses *bold* for labels.
 * Returns one or more strings; each is at most WHATSAPP_MESSAGE_MAX (4096). If total exceeds limit, splits after location (part1 / part2), then further chunks any part that still exceeds limit.
 * @param {Record<string, unknown>} formattedEvent - from format API
 * @param {Record<string, { label: string }>} eventCategories - id → { label }
 * @returns {string[]}
 */
function buildEventPreviewMessage(formattedEvent, eventCategories) {
  const catLabel = (id) => (eventCategories[id]?.label ?? id)
  const title = typeof formattedEvent.Title === 'string' ? formattedEvent.Title : '-'
  const shortDesc = typeof formattedEvent.shortDescription === 'string' ? formattedEvent.shortDescription : '-'
  const mainCatId = formattedEvent.mainCategory
  const mainCatLabel = mainCatId ? catLabel(mainCatId) : '-'
  const categoriesArr = Array.isArray(formattedEvent.categories) ? formattedEvent.categories : []
  const otherCategories = categoriesArr.filter((c) => c !== mainCatId).map(catLabel)
  const loc = formattedEvent.location && typeof formattedEvent.location === 'object' ? formattedEvent.location : {}
  const locLines = []
  if (loc.locationName) locLines.push(String(loc.locationName))
  if (loc.City) locLines.push(String(loc.City))
  if (loc.addressLine1) locLines.push(String(loc.addressLine1))
  if (loc.addressLine2) locLines.push(String(loc.addressLine2))
  if (loc.locationDetails) locLines.push(String(loc.locationDetails))
  if (loc.wazeNavLink || loc.gmapsNavLink) {
    locLines.push('')
    if (loc.wazeNavLink) locLines.push(`ניווט בוויז - ${loc.wazeNavLink}`)
    if (loc.gmapsNavLink) locLines.push(`ניווט בגוגל מפות - ${loc.gmapsNavLink}`)
  }
  const locationBlock = locLines.length ? locLines.join('\n') : '-'

  const occurrences = Array.isArray(formattedEvent.occurrences) ? formattedEvent.occurrences : []
  const occLines = occurrences.map((occ) => {
    const startIso = occ.startTime ?? occ.date
    const dateStr = occ.date ? formatDateDisplayNoYear(occ.date) : (startIso ? formatDateDisplayNoYear(getDateInIsraelFromIso(startIso)) : '-')
    const timeStr = !occ.hasTime || !startIso ? 'כל היום' : (() => {
      const startTime = getTimeInIsraelFromIso(startIso)
      const endTime = occ.endTime ? getTimeInIsraelFromIso(occ.endTime) : ''
      return endTime ? `${startTime} – ${endTime}` : startTime
    })()
    return `תאריך: ${dateStr} | שעה: ${timeStr}`
  })
  const datesBlock = occLines.length ? occLines.join('\n') : '-'

  const priceNum = typeof formattedEvent.price === 'number' ? formattedEvent.price : NaN
  const priceStr = Number.isNaN(priceNum) ? '-' : priceNum === 0 ? 'חינם' : `${priceNum} ₪`

  const urls = Array.isArray(formattedEvent.urls) ? formattedEvent.urls : []
  const linkLines = urls
    .filter((u) => u && typeof u.Title === 'string' && typeof u.Url === 'string')
    .map((u) => `${u.Title} - ${u.Url}`)
  const linksBlock = linkLines.length ? linkLines.join('\n') : '-'

  const part1 = [
    `*שם האירוע:*`,
    title,
    '',
    `*תיאור קצר:*`,
    shortDesc,
    '',
    `*קטגוריה ראשית:*`,
    mainCatLabel,
    '',
    `*קטגוריות נוספות:*`,
    otherCategories.length ? otherCategories.join(', ') : 'ללא',
    '',
    `*מיקום האירוע:*`,
    locationBlock,
  ].join('\n')

  const part2 = [
    `*תאריכים ושעה:*`,
    datesBlock,
    '',
    `*מחיר:*`,
    priceStr,
    '',
    `*לינקים:*`,
    linksBlock,
  ].join('\n')

  const full = part1 + '\n\n' + part2
  if (full.length <= WHATSAPP_MESSAGE_MAX) return [full]
  // Ensure no single part exceeds limit (e.g. very long description or many links)
  const chunks = []
  for (const part of [part1, part2]) {
    if (part.length <= WHATSAPP_MESSAGE_MAX) {
      chunks.push(part)
    } else {
      for (let i = 0; i < part.length; i += WHATSAPP_MESSAGE_MAX) {
        chunks.push(part.slice(i, i + WHATSAPP_MESSAGE_MAX))
      }
    }
  }
  return chunks
}

/**
 * Send confirm step message (summary + אישור ושמירה / עריכת פרטים). Used when entering confirm or returning from edit flow.
 * @param {string} phoneNumberId
 * @param {string} from
 * @param {Record<string, unknown>} formattedPreview - eventAddFormattedPreview
 * @returns {Promise<object>}
 */
async function sendConfirmSummary(phoneNumberId, from, formattedPreview) {
  const previewParts = buildEventPreviewMessage(formattedPreview, EVENT_CATEGORIES)
  const combinedBody = EVENT_ADD_CONFIRM_INTRO + '\n\n' + previewParts.join('\n\n')
  if (combinedBody.length <= WHATSAPP_INTERACTIVE_BODY_MAX) {
    return sendInteractiveButtons(phoneNumberId, from, {
      body: combinedBody,
      buttons: [EVENT_ADD_CONFIRM_SAVE_BUTTON, EVENT_ADD_CONFIRM_EDIT_BUTTON],
    })
  }
  await sendText(phoneNumberId, from, combinedBody)
  return sendInteractiveButtons(phoneNumberId, from, {
    body: EVENT_EDIT_SUCCESS_CHOOSE_BODY,
    buttons: [EVENT_ADD_CONFIRM_SAVE_BUTTON, EVENT_ADD_CONFIRM_EDIT_BUTTON],
  })
}

/**
 * After collecting all flagged field inputs: re-run processDraft, then branch on flags or go to confirm.
 * @param {string} phoneNumberId
 * @param {string} from
 * @param {object} state - current state (with updated eventAdd* from flag inputs)
 * @param {{ profileName?: string }} context
 * @returns {Promise<object>}
 */
async function runProcessDraftAfterFlagInput(phoneNumberId, from, state, context) {
  const draftId = state.eventAddDraftId
  if (!draftId) {
    conversationState.set(from, { step: STEPS.EVENT_ADD_MEDIA })
    await sendText(phoneNumberId, from, EVENT_ADD_FORMAT_FAILED)
    return sendInteractiveButtons(phoneNumberId, from, {
      body: EVENT_ADD_FORMAT_FAILED_RETRY_BODY,
      buttons: [EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON],
    })
  }
  const publisherInfo = { phone: from, name: context?.profileName ?? '', waId: from }
  const rawEvent = buildRawEvent(state, publisherInfo)
  const media = Array.isArray(state.eventAddMedia) ? state.eventAddMedia : []
  const mainCategory = (state.eventAddMainCategory ?? '').trim()
  const categories = Array.isArray(state.eventAddExtraCategories) ? state.eventAddExtraCategories : []
  await sendText(phoneNumberId, from, EVENT_ADD_PROCESSING_MESSAGE)
  const processResult = await processDraft(draftId, { rawEvent, media, mainCategory, categories })
  if (!processResult.success || !processResult.formattedEvent) {
    conversationState.set(from, { step: STEPS.EVENT_ADD_MEDIA })
    await sendText(phoneNumberId, from, EVENT_ADD_FORMAT_FAILED)
    return sendInteractiveButtons(phoneNumberId, from, {
      body: EVENT_ADD_FORMAT_FAILED_RETRY_BODY,
      buttons: [EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON],
    })
  }
  const flags = Array.isArray(processResult.flags) ? processResult.flags : []
  if (flags.length > 0) {
    const flagFieldOrder = getFlagFieldOrder(flags)
    if (flagFieldOrder.length === 0) {
      conversationState.set(from, {
        eventAddFormattedPreview: processResult.formattedEvent,
        step: STEPS.EVENT_ADD_CONFIRM,
        eventAddFlags: undefined,
        eventAddFlagFieldOrder: undefined,
        eventAddFlagIndex: undefined,
      })
      const previewParts = buildEventPreviewMessage(processResult.formattedEvent, EVENT_CATEGORIES)
      const combinedBody = EVENT_ADD_CONFIRM_INTRO + '\n\n' + previewParts.join('\n\n')
      if (combinedBody.length <= WHATSAPP_INTERACTIVE_BODY_MAX) {
        return sendInteractiveButtons(phoneNumberId, from, {
          body: combinedBody,
          buttons: [EVENT_ADD_CONFIRM_SAVE_BUTTON, EVENT_ADD_CONFIRM_EDIT_BUTTON],
        })
      }
      await sendText(phoneNumberId, from, combinedBody)
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_EDIT_SUCCESS_CHOOSE_BODY,
        buttons: [EVENT_ADD_CONFIRM_SAVE_BUTTON, EVENT_ADD_CONFIRM_EDIT_BUTTON],
      })
    }
    conversationState.set(from, {
      eventAddFlags: flags,
      eventAddFormattedPreview: processResult.formattedEvent,
      eventAddFlagFieldOrder: flagFieldOrder,
      eventAddFlagIndex: 0,
      step: STEPS.EVENT_ADD_FLAG_INPUT,
    })
    const flagsBody = buildFlagsMessageBody(flags)
    await sendText(phoneNumberId, from, flagsBody)
    const s = conversationState.get(from)
    return sendAskForFlagField(phoneNumberId, from, s, flagFieldOrder[0])
  }
  conversationState.set(from, {
    eventAddFormattedPreview: processResult.formattedEvent,
    step: STEPS.EVENT_ADD_CONFIRM,
    eventAddFlags: undefined,
    eventAddFlagFieldOrder: undefined,
    eventAddFlagIndex: undefined,
  })
  const previewParts = buildEventPreviewMessage(processResult.formattedEvent, EVENT_CATEGORIES)
  const combinedBody = EVENT_ADD_CONFIRM_INTRO + '\n\n' + previewParts.join('\n\n')
  if (combinedBody.length <= WHATSAPP_INTERACTIVE_BODY_MAX) {
    return sendInteractiveButtons(phoneNumberId, from, {
      body: combinedBody,
      buttons: [EVENT_ADD_CONFIRM_SAVE_BUTTON, EVENT_ADD_CONFIRM_EDIT_BUTTON],
    })
  }
  await sendText(phoneNumberId, from, combinedBody)
  return sendInteractiveButtons(phoneNumberId, from, {
    body: EVENT_EDIT_SUCCESS_CHOOSE_BODY,
    buttons: [EVENT_ADD_CONFIRM_SAVE_BUTTON, EVENT_ADD_CONFIRM_EDIT_BUTTON],
  })
}

/**
 * After user finishes media (skip or max): call format API, then either show confirm step or error and re-show media.
 * @param {string} phoneNumberId
 * @param {string} from
 * @param {object} state - current conversation state
 * @param {{ profileName?: string }} context
 * @param {{ isMaxMedia?: boolean }} opts - when true, we came from max media (EVENT_ADD_MEDIA_MORE or EVENT_ADD_MEDIA)
 * @returns {Promise<object>}
 */
async function goToConfirmOrRetryMedia(phoneNumberId, from, state, context, opts = {}) {
  const publisherInfo = { phone: from, name: context?.profileName ?? '', waId: from }
  const rawEvent = buildRawEvent(state, publisherInfo)
  const media = Array.isArray(state.eventAddMedia) ? state.eventAddMedia : []
  const mainCategory = (state.eventAddMainCategory ?? '').trim()
  const categories = Array.isArray(state.eventAddExtraCategories) ? state.eventAddExtraCategories : []
  const payloadSummary = { mediaCount: media.length, hasRawTitle: !!rawEvent.rawTitle }
  logger.info(LOG_PREFIXES.EVENT_ADD, 'goToConfirmOrRetryMedia', from, payloadSummary)

  await sendText(phoneNumberId, from, EVENT_ADD_PROCESSING_MESSAGE)

  let draftId = state.eventAddDraftId
  if (!draftId) {
    const body = { rawEvent, media, mainCategory, categories }
    const draftResult = await createDraft(body)
    if (!draftResult.success || !draftResult.id) {
      logger.error(LOG_PREFIXES.EVENT_ADD, 'Draft create failed', from)
      conversationState.set(from, { eventAddConfirmPending: undefined })
      await sendText(phoneNumberId, from, 'לא הצלחנו ליצור את האירוע. נסה שוב.')
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_ADD_FORMAT_FAILED_RETRY_BODY,
        buttons: [EVENT_ADD_FORMAT_RETRY_BUTTON],
      })
    }
    draftId = draftResult.id
    conversationState.set(from, { eventAddDraftId: draftId })
  }
  const processResult = await processDraft(draftId, { rawEvent, media, mainCategory, categories })
  if (!processResult.success || !processResult.formattedEvent) {
    logger.info(LOG_PREFIXES.EVENT_ADD, 'Process failed', from, { draftId, reason: processResult.reason || 'no formattedEvent' })
    conversationState.set(from, { eventAddConfirmPending: undefined })
    await sendText(phoneNumberId, from, EVENT_ADD_FORMAT_FAILED)
    return sendInteractiveButtons(phoneNumberId, from, {
      body: EVENT_ADD_FORMAT_FAILED_RETRY_BODY,
      buttons: [EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON],
    })
  }
  const flags = Array.isArray(processResult.flags) ? processResult.flags : []
  if (flags.length > 0) {
    const flagFieldOrder = getFlagFieldOrder(flags)
    if (flagFieldOrder.length === 0) {
      conversationState.set(from, {
        eventAddFormattedPreview: processResult.formattedEvent,
        step: STEPS.EVENT_ADD_CONFIRM,
        eventAddConfirmPending: undefined,
      })
      const previewParts = buildEventPreviewMessage(processResult.formattedEvent, EVENT_CATEGORIES)
      const combinedBody = EVENT_ADD_CONFIRM_INTRO + '\n\n' + previewParts.join('\n\n')
      if (combinedBody.length <= WHATSAPP_INTERACTIVE_BODY_MAX) {
        return sendInteractiveButtons(phoneNumberId, from, {
          body: combinedBody,
          buttons: [EVENT_ADD_CONFIRM_SAVE_BUTTON, EVENT_ADD_CONFIRM_EDIT_BUTTON],
        })
      }
      await sendText(phoneNumberId, from, combinedBody)
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_EDIT_SUCCESS_CHOOSE_BODY,
        buttons: [EVENT_ADD_CONFIRM_SAVE_BUTTON, EVENT_ADD_CONFIRM_EDIT_BUTTON],
      })
    }
    conversationState.set(from, {
      eventAddFlags: flags,
      eventAddFormattedPreview: processResult.formattedEvent,
      eventAddFlagFieldOrder: flagFieldOrder,
      eventAddFlagIndex: 0,
      step: STEPS.EVENT_ADD_FLAG_INPUT,
      eventAddConfirmPending: undefined,
    })
    const flagsBody = buildFlagsMessageBody(flags)
    await sendText(phoneNumberId, from, flagsBody)
    const s = conversationState.get(from)
    return sendAskForFlagField(phoneNumberId, from, s, flagFieldOrder[0])
  }
  conversationState.set(from, {
    eventAddFormattedPreview: processResult.formattedEvent,
    step: STEPS.EVENT_ADD_CONFIRM,
    eventAddConfirmPending: undefined,
  })
  const previewParts = buildEventPreviewMessage(processResult.formattedEvent, EVENT_CATEGORIES)
  const combinedBody = EVENT_ADD_CONFIRM_INTRO + '\n\n' + previewParts.join('\n\n')
  if (combinedBody.length <= WHATSAPP_INTERACTIVE_BODY_MAX) {
    return sendInteractiveButtons(phoneNumberId, from, {
      body: combinedBody,
      buttons: [EVENT_ADD_CONFIRM_SAVE_BUTTON, EVENT_ADD_CONFIRM_EDIT_BUTTON],
    })
  }
  await sendText(phoneNumberId, from, combinedBody)
  return sendInteractiveButtons(phoneNumberId, from, {
    body: EVENT_EDIT_SUCCESS_CHOOSE_BODY,
    buttons: [EVENT_ADD_CONFIRM_SAVE_BUTTON, EVENT_ADD_CONFIRM_EDIT_BUTTON],
  })
}

/** WhatsApp interactive list allows max 10 rows total. One section, 4 rows (group labels). */
function buildCategoryGroupList() {
  return {
    body: EVENT_ADD_ASK_CATEGORY_GROUP,
    button: 'בחר קבוצה',
    sections: [
      {
        title: 'קבוצות',
        rows: CATEGORY_GROUPS.map((g) => ({ id: g.id, title: g.label })),
      },
    ],
  }
}

/**
 * Category group list with intro body (for edit and add flows).
 * @returns {{ body: string, button: string, sections: Array<{ title: string, rows: Array<{ id: string, title: string }> }> }}
 */
function buildCategoryGroupListPayload() {
  return {
    ...buildCategoryGroupList(),
    body: EVENT_ADD_CATEGORY_INTRO + '\n' + EVENT_ADD_ASK_CATEGORY_GROUP,
  }
}

/**
 * Build body text for extra-categories screen: intro + list of extra category labels (excluding main).
 * @param {object|null} preview - eventAddFormattedPreview (formatted event)
 * @returns {string}
 */
function getExtraCategoriesBody(preview) {
  const mainId = preview?.mainCategory
  const cats = Array.isArray(preview?.categories) ? preview.categories : []
  const extraIds = mainId ? cats.filter((id) => id !== mainId) : [...cats]
  const labels = extraIds.map((id) => EVENT_CATEGORIES[id]?.label ?? id)
  return labels.length
    ? EVENT_EDIT_EXTRA_CATEGORIES_BODY + '\n\n' + labels.join('\n')
    : EVENT_EDIT_EXTRA_CATEGORIES_BODY + '\n\n' + EVENT_EDIT_EXTRA_CATEGORIES_NO_EXTRAS
}

/**
 * Send edit success quick-reply buttons (סיימתי לעדכן / לעדכון פרטים נוספים).
 * When body is provided (e.g. "שם האירוע עודכן בהצלחה"), sends a single message with that body and the two buttons.
 * @param {string} phoneNumberId
 * @param {string} from
 * @param {string} [body] - Message body (success text); if omitted uses EVENT_EDIT_SUCCESS_CHOOSE_BODY
 * @returns {Promise<object>}
 */
function sendEditSuccessQuickReplies(phoneNumberId, from, body) {
  return sendInteractiveButtons(phoneNumberId, from, {
    body: body || EVENT_EDIT_SUCCESS_CHOOSE_BODY,
    buttons: [EVENT_EDIT_SUCCESS_DONE_BUTTON, EVENT_EDIT_SUCCESS_MORE_BUTTON],
  })
}

/**
 * Categories in one group only (max 7 rows). Optionally exclude ids, override body, or add a top "change group" row.
 * Uses footer for category AI note when ≤60 chars.
 * @param {string} groupId - CATEGORY_GROUPS[].id
 * @param {{ excludeIds?: string[], bodyOverride?: string, addChangeGroupRow?: boolean }} [opts]
 */
function buildCategoryListForGroup(groupId, opts = {}) {
  const group = CATEGORY_GROUPS.find((g) => g.id === groupId)
  const defaultBody = EVENT_ADD_ASK_MAIN_CATEGORY
  const defaultFooter = EVENT_ADD_CATEGORY_FOOTER
  if (!group) return { body: opts.bodyOverride || defaultBody, footer: defaultFooter, button: 'בחר קטגוריה', sections: [{ title: '', rows: [] }] }
  const excludeIds = opts.excludeIds || []
  const rows = group.categoryIds
    .filter((id) => !excludeIds.includes(id))
    .map((id) => ({ id, title: EVENT_CATEGORIES[id]?.label || id }))
  const categorySection = { title: group.label, rows }
  const sections = opts.addChangeGroupRow
    ? [
        { title: '', rows: [{ id: EVENT_ADD_CHANGE_GROUP_BUTTON.id, title: EVENT_ADD_CHANGE_GROUP_ROW_TITLE }] },
        categorySection,
      ]
    : [categorySection]
  return {
    body: opts.bodyOverride || defaultBody,
    footer: defaultFooter,
    button: 'בחר קטגוריה',
    sections,
  }
}

/**
 * Build flags intro + for each flag: *label* \n reason, separated by empty row.
 * @param {Array<{ fieldKey: string, reason: string }>} flags
 * @returns {string}
 */
function buildFlagsMessageBody(flags) {
  if (!Array.isArray(flags) || flags.length === 0) return ''
  const lines = [EVENT_ADD_FLAGS_INTRO]
  for (const f of flags) {
    const config = FLAG_FIELD_CONFIGS[f.fieldKey]
    const label = config ? config.label : f.fieldKey
    lines.push('')
    lines.push(`*${label}*`)
    lines.push(f.reason || '')
  }
  lines.push('')
  lines.push(EVENT_ADD_FLAGS_FILL_AGAIN)
  return lines.join('\n').replace(/^\n/, '')
}

/**
 * Send the "ask" message for a flagged field (text, text+skip, or category list).
 * @param {string} phoneNumberId
 * @param {string} from
 * @param {object} state
 * @param {string} fieldKey
 * @returns {Promise<object>}
 */
async function sendAskForFlagField(phoneNumberId, from, state, fieldKey) {
  const config = FLAG_FIELD_CONFIGS[fieldKey]
  if (!config) return sendText(phoneNumberId, from, EVENT_ADD_ASK_TITLE)
  if (config.inputType === 'list') {
    const groupId = state.eventAddMainCategoryGroupId
    if (!groupId) return sendText(phoneNumberId, from, config.ask)
    const listPayload = buildCategoryListForGroup(groupId, { bodyOverride: config.ask })
    return sendInteractiveList(phoneNumberId, from, listPayload)
  }
  if (config.inputType === 'text_skip') {
    const canSkip = fieldKey === 'rawAddress' ? !!(state.eventAddPlaceName ?? '').trim() : true
    if (canSkip) {
      return sendInteractiveButtons(phoneNumberId, from, {
        body: config.ask,
        footer: config.footer,
        buttons: [EVENT_ADD_SKIP_BUTTON],
      })
    }
  }
  return sendText(phoneNumberId, from, config.footer ? config.ask + '\n' + config.footer : config.ask)
}

/**
 * Validate and parse user input for a flagged field. Returns state update and optional error.
 * @param {string} fieldKey
 * @param {{ textBody: string, buttonId: string|null, listReplyId: string|null }} msg
 * @param {object} state
 * @returns {{ ok: boolean, errorMessage?: string, stateUpdate?: object }}
 */
function validateAndParseFlagFieldInput(fieldKey, msg, state) {
  const config = FLAG_FIELD_CONFIGS[fieldKey]
  if (!config) return { ok: false, errorMessage: EVENT_ADD_VALIDATE_TITLE }
  const { textBody, buttonId, listReplyId } = msg
  const limits = config.lengthLimits || {}

  if (config.inputType === 'list') {
    if (!listReplyId) return { ok: false, errorMessage: config.validate }
    if (!VALID_CATEGORY_IDS.has(listReplyId)) return { ok: false, errorMessage: config.validate }
    const groupId = state.eventAddMainCategoryGroupId
    if (groupId) {
      const group = CATEGORY_GROUPS.find((g) => g.id === groupId)
      if (group && !group.categoryIds.includes(listReplyId)) return { ok: false, errorMessage: config.validate }
    }
    return { ok: true, stateUpdate: { eventAddMainCategory: listReplyId } }
  }

  if (config.inputType === 'text_skip' && buttonId === EVENT_ADD_SKIP_BUTTON.id) {
    if (fieldKey === 'rawAddress') {
      return { ok: true, stateUpdate: { eventAddAddressLine1: '', eventAddAddressLine2: '' } }
    }
    const update = {}
    for (const k of config.stateKeys) update[k] = ''
    return { ok: true, stateUpdate: update }
  }

  if (config.inputType === 'text_skip' && buttonId === EVENT_ADD_SKIP_BUTTON.id) {
    if (fieldKey === 'rawAddress') {
      return { ok: true, stateUpdate: { eventAddAddressLine1: '', eventAddAddressLine2: '' } }
    }
    const update = {}
    for (const k of config.stateKeys) update[k] = ''
    return { ok: true, stateUpdate: update }
  }

  const text = (textBody ?? '').trim()
  if (config.inputType === 'text' && !text) {
    return { ok: false, errorMessage: config.validate }
  }
  // Optional fields: empty is valid; only validate when there is data
  if (config.inputType === 'text_skip' && !text) {
    if (fieldKey === 'rawAddress') {
      return { ok: true, stateUpdate: { eventAddAddressLine1: '', eventAddAddressLine2: '' } }
    }
    const update = {}
    for (const k of config.stateKeys) update[k] = ''
    return { ok: true, stateUpdate: update }
  }

  // Has content: validate for processing (length, format)
  if (fieldKey === 'rawAddress') {
    const lines = text.split(/\n/).map((s) => s.trim()).filter(Boolean)
    if (lines.length > 2) return { ok: false, errorMessage: config.validate }
    const line1 = (lines[0] ?? '').trim()
    const line2 = (lines[1] ?? '').trim()
    if (line1.length > EVENT_ADD_ADDRESS_MAX || line2.length > EVENT_ADD_ADDRESS_MAX) {
      return { ok: false, errorMessage: config.validate }
    }
    return { ok: true, stateUpdate: { eventAddAddressLine1: line1, eventAddAddressLine2: line2 } }
  }

  if (limits.min !== undefined && text.length < limits.min) return { ok: false, errorMessage: config.validate }
  if (limits.max !== undefined && text.length > limits.max) return { ok: false, errorMessage: config.validate }
  const stateUpdate = {}
  for (const k of config.stateKeys) stateUpdate[k] = text
  return { ok: true, stateUpdate }
}

/**
 * Transition to place-name step: set state, send location intro, then place name with skip button.
 * @param {string} phoneNumberId
 * @param {string} from
 * @returns {Promise<object>}
 */
async function sendLocationIntroAndPlaceName(phoneNumberId, from) {
  conversationState.set(from, { step: STEPS.EVENT_ADD_PLACE_NAME })
  await sendText(phoneNumberId, from, EVENT_ADD_LOCATION_INTRO)
  return sendInteractiveButtons(phoneNumberId, from, {
    body: EVENT_ADD_ASK_PLACE_NAME,
    buttons: [EVENT_ADD_SKIP_BUTTON],
  })
}

/**
 * Send validation requirements message then re-ask (two separate messages). Step does not advance.
 * @param {string} phoneNumberId
 * @param {string} from
 * @param {string} requirementsMessage
 * @param {() => Promise<object>} reaskFn - e.g. () => sendText(...) or () => sendInteractiveList(...)
 * @returns {Promise<object>}
 */
function sendValidationAndReask(phoneNumberId, from, requirementsMessage, reaskFn) {
  return sendText(phoneNumberId, from, requirementsMessage).then((r) => {
    if (r && !r.success) return r
    return reaskFn()
  })
}

/**
 * Build rawEvent for create API. Keys follow raw* convention (rawTitle, rawCity, rawOccurrences, etc.).
 * publisherId is set by the API.
 * @param {object} state - conversation state
 * @param {{ phone?: string, name?: string, waId?: string }} publisherInfo - from/context
 */
function buildRawEvent(state, publisherInfo) {
  const phone = normalizePhone(publisherInfo?.phone ?? '')
  const name = (publisherInfo?.name ?? '').trim()
  const waId = String(publisherInfo?.waId ?? '')
  return {
    rawTitle: (state.eventAddTitle ?? '').trim(),
    rawOccurrences: (state.eventAddDateTime ?? '').trim(),
    rawLocationName: (state.eventAddPlaceName ?? '').trim() || undefined,
    rawCity: (state.eventAddCity ?? '').trim(),
    rawAddressLine1: (state.eventAddAddressLine1 ?? '').trim() || undefined,
    rawAddressLine2: (state.eventAddAddressLine2 ?? '').trim() || undefined,
    rawLocationDetails: (state.eventAddLocationNotes ?? '').trim() || undefined,
    rawNavLinks: (state.eventAddNavLinks ?? '').trim() || undefined,
    rawPrice: (state.eventAddPrice ?? '').trim() || undefined,
    rawFullDescription: (state.eventAddDescription ?? '').trim(),
    rawUrls: (state.eventAddLinks ?? '').trim() || undefined,
    publisher: { phone, name, waId },
  }
}

/**
 * Kill event-add flow: delete uploaded media from Cloudinary, clear state, send welcome.
 * @param {string} phoneNumberId
 * @param {string} from
 * @param {object} state - current conversation state (must have eventAddMedia if any)
 * @returns {Promise<object>}
 */
async function killEventAddFlow(phoneNumberId, from, state) {
  logger.info(LOG_PREFIXES.EVENT_ADD, 'Flow killed', from)
  const media = Array.isArray(state.eventAddMedia) ? state.eventAddMedia : []
  if (media.length > 0) {
    const items = media
      .filter((m) => m?.cloudinaryData?.public_id)
      .map((m) => {
        const rt = m.cloudinaryData.resource_type
        const resourceType = rt === 'video' ? 'video' : rt === 'raw' ? 'raw' : 'image'
        return { publicId: m.cloudinaryData.public_id, resourceType }
      })
    if (items.length > 0) {
      await deleteMediaOnApp(items)
    }
  }
  conversationState.clear(from)
  return sendInteractiveButtons(phoneNumberId, from, WELCOME_INTERACTIVE)
}

/**
 * Send initial event-add message and ask title. Call after setting step to EVENT_ADD_INITIAL.
 */
export function sendInitialMessage(phoneNumberId, from) {
  conversationState.set(from, { step: STEPS.EVENT_ADD_TITLE, eventAddLastActivityAt: Date.now() })
  return sendText(phoneNumberId, from, EVENT_ADD_INITIAL).then((r) => {
    if (r && !r.success) return r
    return sendText(phoneNumberId, from, EVENT_ADD_ASK_TITLE)
  })
}

/**
 * Submit event: activate existing draft (when we have eventAddDraftId) or fallback to create API. Clear state, send success and welcome.
 * @param {{ keepStateForMaxMedia?: boolean, formattedEvent?: object }} [opts] - keepStateForMaxMedia: do not clear; formattedEvent: used only when no draftId (fallback create path)
 */
async function submitEvent(phoneNumberId, from, state, context, opts = {}) {
  let result
  if (state.eventAddDraftId) {
    result = await activateEvent(state.eventAddDraftId)
    if (result.success) result.id = state.eventAddDraftId
  } else {
    const publisherInfo = { phone: from, name: context?.profileName ?? '', waId: from }
    const rawEvent = buildRawEvent(state, publisherInfo)
    const media = Array.isArray(state.eventAddMedia) ? state.eventAddMedia : []
    const mainCategory = (state.eventAddMainCategory ?? '').trim()
    const categories = Array.isArray(state.eventAddExtraCategories) ? state.eventAddExtraCategories : []
    const body = { rawEvent, media, mainCategory, categories }
    if (opts.formattedEvent && typeof opts.formattedEvent === 'object') {
      body.formattedEvent = opts.formattedEvent
    }
    result = await createEvent(body)
  }
  if (!opts.keepStateForMaxMedia) {
    conversationState.clear(from)
  }
  if (result.success) {
    logger.info(LOG_PREFIXES.EVENT_ADD, 'Event created', from, result.id)
    const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
    const eventLink = result.id ? `${baseUrl}?event=${encodeURIComponent(result.id)}` : baseUrl
    const successBody = [
      EVENT_ADD_SUCCESS_HEADING,
      '',
      EVENT_ADD_SUCCESS_BODY,
      '',
      EVENT_ADD_SUCCESS_VIEW_PROMPT,
      eventLink,
    ].join('\n')
    return sendInteractiveButtons(phoneNumberId, from, {
      body: successBody,
      buttons: [EVENT_ADD_SUCCESS_ADD_AGAIN_BUTTON, EVENT_ADD_SUCCESS_MAIN_MENU_BUTTON],
    })
  } else {
    logger.error(LOG_PREFIXES.EVENT_ADD, 'Event create/activate failed', from, result.reason || '')
    const failMsg = result.reason && result.reason.length <= 200
      ? `משהו השתבש בשמירה: ${result.reason}\n\nנסה שוב מאוחר יותר.`
      : 'משהו השתבש בשמירה. נסה שוב מאוחר יותר.'
    await sendText(phoneNumberId, from, failMsg)
  }
  return sendInteractiveButtons(phoneNumberId, from, WELCOME_INTERACTIVE)
}

/**
 * Handle one media message: download from WA, upload to Nuxt, append to state.
 * @returns {Promise<{ cloudinaryURL: string, cloudinaryData: object, isMain: boolean }|null>}
 */
async function processIncomingMedia(mediaId, state) {
  const downloaded = await downloadMedia(mediaId)
  if (!downloaded) return null
  const { buffer, mimetype } = downloaded
  const ext = mimetype.includes('video') ? 'mp4' : 'jpg'
  const filename = `event-${Date.now()}.${ext}`
  const data = await uploadMediaToApp(buffer, mimetype, filename)
  if (!data || !data.secure_url) return null
  const isMain = !Array.isArray(state.eventAddMedia) || state.eventAddMedia.length === 0
  return {
    cloudinaryURL: data.secure_url,
    cloudinaryData: data,
    isMain,
  }
}

/**
 * Handle event-add flow step. Returns promise that sends reply.
 * @param {string} phoneNumberId
 * @param {string} from
 * @param {object} msg - WhatsApp message (type, text, image, video, interactive)
 * @param {object} state - conversation state
 * @param {{ profileName?: string }} context
 * @returns {Promise<object>}
 */
export async function handleEventAddFlow(phoneNumberId, from, msg, state, context) {
  const step = state.step
  const interactive = msg.interactive
  const buttonId = interactive?.type === 'button_reply' ? interactive.button_reply?.id : null
  const listReplyId = interactive?.type === 'list_reply' ? interactive.list_reply?.id : null
  const textBody = msg.type === 'text' && msg.text?.body ? String(msg.text.body).trim() : ''
  const mediaId = msg.image?.id || msg.video?.id || null

  const lastActivityAt = state.eventAddLastActivityAt
  if (typeof lastActivityAt === 'number' && Date.now() - lastActivityAt > EVENT_ADD_TIMEOUT_MS) {
    return killEventAddFlow(phoneNumberId, from, state)
  }

  if (buttonId === 'back_to_main' || buttonId === 'back_to_menu') {
    return killEventAddFlow(phoneNumberId, from, state)
  }

  if (textBody === 'ביטול') {
    return killEventAddFlow(phoneNumberId, from, state)
  }

  conversationState.set(from, { eventAddLastActivityAt: Date.now() })

  if (step === STEPS.EVENT_ADD_CONFIRM) {
    if (buttonId === EVENT_ADD_CONFIRM_SAVE_BUTTON.id) {
      const preview = state.eventAddFormattedPreview
      if (preview && typeof preview === 'object') {
        return submitEvent(phoneNumberId, from, state, context, { formattedEvent: preview })
      }
      logger.error(LOG_PREFIXES.EVENT_ADD, 'Confirm save but no formatted preview', from)
      conversationState.clear(from)
      await sendText(phoneNumberId, from, 'משהו השתבש. נסה להתחיל מחדש.')
      return sendInteractiveButtons(phoneNumberId, from, WELCOME_INTERACTIVE)
    }
    if (buttonId === EVENT_ADD_CONFIRM_EDIT_BUTTON.id) {
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_MENU, eventAddLastActivityAt: Date.now() })
      return sendInteractiveList(phoneNumberId, from, buildEditMenuListPayload())
    }
    return Promise.resolve()
  }

  if (step === STEPS.EVENT_ADD_EDIT_MENU) {
    if (listReplyId === EDIT_DONE_ID) {
      conversationState.set(from, { step: STEPS.EVENT_ADD_CONFIRM })
      const preview = state.eventAddFormattedPreview
      if (preview && typeof preview === 'object') {
        return sendConfirmSummary(phoneNumberId, from, preview)
      }
      return sendInteractiveList(phoneNumberId, from, buildEditMenuListPayload())
    }
    if (listReplyId === 'edit_title') {
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_FIELD, eventEditFieldKey: 'title' })
      return sendText(phoneNumberId, from, EVENT_EDIT_ASK_TITLE)
    }
    if (listReplyId === 'edit_description') {
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_FIELD, eventEditFieldKey: 'description' })
      return sendText(phoneNumberId, from, EVENT_EDIT_ASK_DESCRIPTION)
    }
    if (listReplyId === 'edit_main_category') {
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_MAIN_CATEGORY_GROUP })
      const groupListPayload = buildCategoryGroupListPayload()
      return sendInteractiveList(phoneNumberId, from, groupListPayload)
    }
    if (listReplyId === 'edit_extra_categories') {
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_EXTRA_CATEGORIES })
      return sendInteractiveButtons(phoneNumberId, from, {
        body: getExtraCategoriesBody(state.eventAddFormattedPreview),
        buttons: [EVENT_EDIT_EXTRA_ADD_BUTTON, EVENT_EDIT_EXTRA_REMOVE_BUTTON, EVENT_EDIT_EXTRA_BACK_BUTTON],
      })
    }
    if (listReplyId === 'edit_location') {
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_LOCATION_MENU })
      return sendInteractiveList(phoneNumberId, from, buildLocationEditMenuPayload())
    }
    return sendInteractiveList(phoneNumberId, from, buildEditMenuListPayload())
  }

  if (step === STEPS.EVENT_ADD_EDIT_FIELD) {
    const fieldKey = state.eventEditFieldKey
    const draftId = state.eventAddDraftId
    if (!draftId || !textBody) {
      if (fieldKey === 'title') return sendText(phoneNumberId, from, EVENT_EDIT_ASK_TITLE)
      if (fieldKey === 'description') return sendText(phoneNumberId, from, EVENT_EDIT_ASK_DESCRIPTION)
      return sendInteractiveList(phoneNumberId, from, buildEditMenuListPayload())
    }
    if (fieldKey === 'title') {
      const len = textBody.length
      if (len < EVENT_ADD_TITLE_MIN || len > EVENT_ADD_TITLE_MAX) {
        return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_TITLE, () =>
          sendText(phoneNumberId, from, EVENT_EDIT_ASK_TITLE),
        )
      }
      const result = await patchDraft(draftId, { title: textBody })
      if (!result.success) {
        await sendText(phoneNumberId, from, EVENT_EDIT_PATCH_ERROR)
        conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_MENU })
        return sendInteractiveList(phoneNumberId, from, buildEditMenuListPayload())
      }
      conversationState.set(from, {
        eventAddFormattedPreview: result.event || state.eventAddFormattedPreview,
        step: STEPS.EVENT_ADD_EDIT_SUCCESS,
        eventEditFieldKey: undefined,
      })
      return sendEditSuccessQuickReplies(phoneNumberId, from, EVENT_EDIT_SUCCESS_MESSAGES.title)
    }
    if (fieldKey === 'description') {
      const len = textBody.length
      if (len < EVENT_ADD_DESCRIPTION_MIN || len > EVENT_ADD_DESCRIPTION_MAX) {
        return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_DESCRIPTION, () =>
          sendText(phoneNumberId, from, EVENT_EDIT_ASK_DESCRIPTION),
        )
      }
      const preview = state.eventAddFormattedPreview
      const currentTitle = preview && typeof preview.Title === 'string' ? preview.Title : ''
      const shortResult = await generateShortDescription(currentTitle, textBody, {
        openaiApiKey: config.openaiApiKey,
        openaiModel: config.openaiModel,
      })
      const shortDescription = shortResult.shortDescription || (preview?.shortDescription && typeof preview.shortDescription === 'string' ? preview.shortDescription : '')
      const patchPayload = { fullDescription: textBody, shortDescription }
      const result = await patchDraft(draftId, patchPayload)
      if (!result.success) {
        await sendText(phoneNumberId, from, EVENT_EDIT_PATCH_ERROR)
        conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_MENU })
        return sendInteractiveList(phoneNumberId, from, buildEditMenuListPayload())
      }
      conversationState.set(from, {
        eventAddFormattedPreview: result.event || state.eventAddFormattedPreview,
        step: STEPS.EVENT_ADD_EDIT_SUCCESS,
        eventEditFieldKey: undefined,
      })
      return sendEditSuccessQuickReplies(phoneNumberId, from, EVENT_EDIT_SUCCESS_MESSAGES.description)
    }
    conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_MENU, eventEditFieldKey: undefined })
    return sendInteractiveList(phoneNumberId, from, buildEditMenuListPayload())
  }

  if (step === STEPS.EVENT_ADD_EDIT_MAIN_CATEGORY_GROUP) {
    const groupListPayload = buildCategoryGroupListPayload()
    if (listReplyId && !VALID_GROUP_IDS.has(listReplyId)) {
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_MAIN_CATEGORY_GROUP, () =>
        sendInteractiveList(phoneNumberId, from, groupListPayload),
      )
    }
    if (!listReplyId) {
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_MAIN_CATEGORY_GROUP, () =>
        sendInteractiveList(phoneNumberId, from, groupListPayload),
      )
    }
    conversationState.set(from, {
      eventAddMainCategoryGroupId: listReplyId,
      step: STEPS.EVENT_ADD_EDIT_MAIN_CATEGORY,
    })
    const categoryListPayload = buildCategoryListForGroup(listReplyId, { addChangeGroupRow: true })
    return sendInteractiveList(phoneNumberId, from, categoryListPayload)
  }

  if (step === STEPS.EVENT_ADD_EDIT_MAIN_CATEGORY) {
    if (buttonId === EVENT_ADD_CHANGE_GROUP_BUTTON.id) {
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_MAIN_CATEGORY_GROUP })
      const groupListPayload = buildCategoryGroupListPayload()
      return sendInteractiveList(phoneNumberId, from, groupListPayload)
    }
    if (listReplyId && !VALID_CATEGORY_IDS.has(listReplyId)) {
      const groupId = state.eventAddMainCategoryGroupId
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_MAIN_CATEGORY, () =>
        sendInteractiveList(phoneNumberId, from, buildCategoryListForGroup(groupId, { addChangeGroupRow: true })),
      )
    }
    if (!listReplyId) {
      const groupId = state.eventAddMainCategoryGroupId
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_MAIN_CATEGORY, () =>
        sendInteractiveList(phoneNumberId, from, buildCategoryListForGroup(groupId, { addChangeGroupRow: true })),
      )
    }
    const draftId = state.eventAddDraftId
    const preview = state.eventAddFormattedPreview
    const categories = Array.isArray(preview?.categories) ? [...preview.categories] : []
    const newMain = listReplyId
    if (!categories.includes(newMain)) categories.unshift(newMain)
    const result = await patchDraft(draftId, { mainCategory: newMain, categories })
    if (!result.success) {
      await sendText(phoneNumberId, from, EVENT_EDIT_PATCH_ERROR)
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_MENU })
      return sendInteractiveList(phoneNumberId, from, buildEditMenuListPayload())
    }
    conversationState.set(from, {
      eventAddFormattedPreview: result.event || state.eventAddFormattedPreview,
      step: STEPS.EVENT_ADD_EDIT_SUCCESS,
      eventAddMainCategoryGroupId: undefined,
    })
    return sendEditSuccessQuickReplies(phoneNumberId, from, EVENT_EDIT_SUCCESS_MESSAGES.mainCategory)
  }

  function sendExtraCategoriesScreen() {
    const current = conversationState.get(from)
    return sendInteractiveButtons(phoneNumberId, from, {
      body: getExtraCategoriesBody(current.eventAddFormattedPreview),
      buttons: [EVENT_EDIT_EXTRA_ADD_BUTTON, EVENT_EDIT_EXTRA_REMOVE_BUTTON, EVENT_EDIT_EXTRA_BACK_BUTTON],
    })
  }

  if (step === STEPS.EVENT_ADD_EDIT_EXTRA_CATEGORIES) {
    if (buttonId === EVENT_EDIT_EXTRA_BACK_BUTTON.id) {
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_MENU })
      return sendInteractiveList(phoneNumberId, from, buildEditMenuListPayload())
    }
    if (buttonId === EVENT_EDIT_EXTRA_ADD_BUTTON.id) {
      const preview = state.eventAddFormattedPreview
      const categories = Array.isArray(preview?.categories) ? preview.categories : []
      if (categories.length >= EVENT_ADD_MAX_CATEGORIES) {
        await sendText(phoneNumberId, from, EVENT_EDIT_EXTRA_MAX_REACHED(EVENT_ADD_MAX_EXTRA_CATEGORIES))
        return sendInteractiveButtons(phoneNumberId, from, {
          body: EVENT_EDIT_SUCCESS_CHOOSE_BODY,
          buttons: [EVENT_EDIT_EXTRA_REMOVE_BUTTON, EVENT_EDIT_EXTRA_BACK_BUTTON],
        })
      }
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_EXTRA_ADD_GROUP })
      const groupListPayload = buildCategoryGroupListPayload()
      return sendInteractiveList(phoneNumberId, from, groupListPayload)
    }
    if (buttonId === EVENT_EDIT_EXTRA_REMOVE_BUTTON.id) {
      const preview = state.eventAddFormattedPreview
      const mainId = preview?.mainCategory
      const cats = Array.isArray(preview?.categories) ? preview.categories : []
      const extraIds = mainId ? cats.filter((id) => id !== mainId) : [...cats]
      if (extraIds.length === 0) {
        await sendText(phoneNumberId, from, EVENT_EDIT_EXTRA_NO_REMOVE)
        return sendExtraCategoriesScreen()
      }
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_EXTRA_REMOVE })
      const rows = extraIds.map((id) => ({ id, title: EVENT_CATEGORIES[id]?.label ?? id }))
      return sendInteractiveList(phoneNumberId, from, {
        body: EVENT_EDIT_EXTRA_REMOVE_ASK,
        button: 'בחר',
        sections: [{ title: 'קטגוריות', rows }],
      })
    }
    return sendExtraCategoriesScreen()
  }

  if (step === STEPS.EVENT_ADD_EDIT_EXTRA_ADD_GROUP) {
    const groupListPayload = buildCategoryGroupListPayload()
    if (listReplyId && !VALID_GROUP_IDS.has(listReplyId)) {
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_MAIN_CATEGORY_GROUP, () =>
        sendInteractiveList(phoneNumberId, from, groupListPayload),
      )
    }
    if (!listReplyId) {
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_MAIN_CATEGORY_GROUP, () =>
        sendInteractiveList(phoneNumberId, from, groupListPayload),
      )
    }
    conversationState.set(from, {
      eventAddMainCategoryGroupId: listReplyId,
      step: STEPS.EVENT_ADD_EDIT_EXTRA_ADD_CATEGORY,
    })
    const categoryListPayload = buildCategoryListForGroup(listReplyId, { addChangeGroupRow: true })
    return sendInteractiveList(phoneNumberId, from, categoryListPayload)
  }

  if (step === STEPS.EVENT_ADD_EDIT_EXTRA_ADD_CATEGORY) {
    if (buttonId === EVENT_ADD_CHANGE_GROUP_BUTTON.id) {
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_EXTRA_ADD_GROUP })
      const groupListPayload = buildCategoryGroupListPayload()
      return sendInteractiveList(phoneNumberId, from, groupListPayload)
    }
    if (!listReplyId || !VALID_CATEGORY_IDS.has(listReplyId)) {
      const groupId = state.eventAddMainCategoryGroupId
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_MAIN_CATEGORY, () =>
        sendInteractiveList(phoneNumberId, from, buildCategoryListForGroup(groupId, { addChangeGroupRow: true })),
      )
    }
    const draftId = state.eventAddDraftId
    const preview = state.eventAddFormattedPreview
    const categories = Array.isArray(preview?.categories) ? [...preview.categories] : []
    const newId = listReplyId
    if (!categories.includes(newId)) categories.push(newId)
    const result = await patchDraft(draftId, { categories })
    if (!result.success) {
      const reason = typeof result.reason === 'string' ? result.reason : ''
      const isMaxCategories = /maximum|exceed/i.test(reason)
      const errMsg = isMaxCategories ? EVENT_EDIT_EXTRA_MAX_REACHED(EVENT_ADD_MAX_EXTRA_CATEGORIES) : EVENT_EDIT_PATCH_ERROR
      await sendText(phoneNumberId, from, errMsg)
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_EXTRA_CATEGORIES })
      return sendExtraCategoriesScreen()
    }
    conversationState.set(from, {
      eventAddFormattedPreview: result.event || state.eventAddFormattedPreview,
      step: STEPS.EVENT_ADD_EDIT_EXTRA_CATEGORIES,
      eventAddMainCategoryGroupId: undefined,
    })
    return sendExtraCategoriesScreen()
  }

  if (step === STEPS.EVENT_ADD_EDIT_EXTRA_REMOVE) {
    const preview = state.eventAddFormattedPreview
    const mainId = preview?.mainCategory
    const cats = Array.isArray(preview?.categories) ? preview.categories : []
    const extraIds = mainId ? cats.filter((id) => id !== mainId) : [...cats]
    if (!listReplyId || !extraIds.includes(listReplyId)) {
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_EXTRA_CATEGORIES })
      return sendExtraCategoriesScreen()
    }
    const draftId = state.eventAddDraftId
    const newCategories = cats.filter((id) => id !== listReplyId)
    if (newCategories.length === 0) {
      await sendText(phoneNumberId, from, EVENT_EDIT_EXTRA_CANNOT_REMOVE_LAST)
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_EXTRA_CATEGORIES })
      return sendExtraCategoriesScreen()
    }
    const result = await patchDraft(draftId, { categories: newCategories })
    if (!result.success) {
      await sendText(phoneNumberId, from, EVENT_EDIT_PATCH_ERROR)
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_EXTRA_CATEGORIES })
      return sendExtraCategoriesScreen()
    }
    conversationState.set(from, {
      eventAddFormattedPreview: result.event || state.eventAddFormattedPreview,
      step: STEPS.EVENT_ADD_EDIT_EXTRA_CATEGORIES,
    })
    return sendExtraCategoriesScreen()
  }

  if (step === STEPS.EVENT_ADD_EDIT_LOCATION_MENU) {
    if (listReplyId === EVENT_EDIT_LOCATION_DONE_ROW.id) {
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_SUCCESS })
      return sendEditSuccessQuickReplies(phoneNumberId, from, EVENT_EDIT_SUCCESS_MESSAGES.location)
    }
    if (listReplyId === EVENT_EDIT_LOCATION_BACK_ROW.id) {
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_MENU })
      return sendInteractiveList(phoneNumberId, from, buildEditMenuListPayload())
    }
    const fieldConfig = LOCATION_FIELD_MAP[listReplyId]
    if (fieldConfig) {
      conversationState.set(from, {
        step: STEPS.EVENT_ADD_EDIT_LOCATION_FIELD,
        eventEditLocationFieldKey: fieldConfig.key,
      })
      return sendText(phoneNumberId, from, fieldConfig.ask)
    }
    return sendInteractiveList(phoneNumberId, from, buildLocationEditMenuPayload())
  }

  if (step === STEPS.EVENT_ADD_EDIT_LOCATION_FIELD) {
    const fieldKey = state.eventEditLocationFieldKey
    const draftId = state.eventAddDraftId

    if (!draftId) {
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_LOCATION_MENU })
      return sendInteractiveList(phoneNumberId, from, buildLocationEditMenuPayload())
    }

    if (!textBody) {
      const rowId = Object.keys(LOCATION_FIELD_MAP).find((id) => LOCATION_FIELD_MAP[id].key === fieldKey)
      const ask = rowId ? LOCATION_FIELD_MAP[rowId].ask : EVENT_EDIT_LOCATION_ASK_PLACE_NAME
      return sendText(phoneNumberId, from, ask)
    }

    let locationPatch = {}

    if (fieldKey === 'locationName' || fieldKey === 'addressLine1' || fieldKey === 'addressLine2' || fieldKey === 'locationDetails') {
      locationPatch[fieldKey] = textBody.trim() || null
    } else if (fieldKey === 'City') {
      const norm = await normalizeCityForEdit(textBody, {
        openaiApiKey: config.openaiApiKey,
        openaiModel: config.openaiModel,
      })
      if (norm.city === null) {
        await sendText(phoneNumberId, from, EVENT_EDIT_LOCATION_CITY_UNRECOGNIZED)
        conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_LOCATION_MENU })
        return sendInteractiveList(phoneNumberId, from, buildLocationEditMenuPayload())
      }
      locationPatch.City = norm.city
    } else if (fieldKey === 'gmapsNavLink' || fieldKey === 'wazeNavLink') {
      const extracted = extractNavLinksFromRaw(
        fieldKey === 'wazeNavLink' ? textBody : '',
        fieldKey === 'gmapsNavLink' ? textBody : ''
      )
      if (fieldKey === 'gmapsNavLink') {
        locationPatch.gmapsNavLink = extracted.gmapsNavLink || null
      } else {
        locationPatch.wazeNavLink = extracted.wazeNavLink || null
      }
    } else {
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_LOCATION_MENU, eventEditLocationFieldKey: undefined })
      return sendInteractiveList(phoneNumberId, from, buildLocationEditMenuPayload())
    }

    const result = await patchDraft(draftId, { location: locationPatch })
    if (!result.success) {
      await sendText(phoneNumberId, from, EVENT_EDIT_PATCH_ERROR)
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_LOCATION_MENU })
      return sendInteractiveList(phoneNumberId, from, buildLocationEditMenuPayload())
    }
    conversationState.set(from, {
      eventAddFormattedPreview: result.event || state.eventAddFormattedPreview,
      step: STEPS.EVENT_ADD_EDIT_SUCCESS,
      eventEditLocationFieldKey: undefined,
    })
    return sendEditSuccessQuickReplies(phoneNumberId, from, EVENT_EDIT_SUCCESS_MESSAGES.location)
  }

  if (step === STEPS.EVENT_ADD_EDIT_SUCCESS) {
    if (buttonId === EVENT_EDIT_SUCCESS_DONE_BUTTON.id) {
      conversationState.set(from, { step: STEPS.EVENT_ADD_CONFIRM })
      const preview = state.eventAddFormattedPreview
      if (preview && typeof preview === 'object') {
        return sendConfirmSummary(phoneNumberId, from, preview)
      }
      return sendInteractiveList(phoneNumberId, from, buildEditMenuListPayload())
    }
    if (buttonId === EVENT_EDIT_SUCCESS_MORE_BUTTON.id) {
      conversationState.set(from, { step: STEPS.EVENT_ADD_EDIT_MENU })
      return sendInteractiveList(phoneNumberId, from, buildEditMenuListPayload())
    }
    return sendEditSuccessQuickReplies(phoneNumberId, from)
  }

  if (step === STEPS.EVENT_ADD_FLAG_INPUT) {
    const order = Array.isArray(state.eventAddFlagFieldOrder) ? state.eventAddFlagFieldOrder : []
    const idx = typeof state.eventAddFlagIndex === 'number' ? state.eventAddFlagIndex : 0
    if (order.length === 0 || idx >= order.length) {
      return sendText(phoneNumberId, from, EVENT_ADD_ASK_TITLE)
    }
    const fieldKey = order[idx]
    const config = FLAG_FIELD_CONFIGS[fieldKey]
    if (!config) {
      conversationState.set(from, { eventAddFlagIndex: idx + 1 })
      const nextIdx = idx + 1
      if (nextIdx >= order.length) {
        return runProcessDraftAfterFlagInput(phoneNumberId, from, conversationState.get(from), context)
      }
      return sendAskForFlagField(phoneNumberId, from, conversationState.get(from), order[nextIdx])
    }
    const parsed = validateAndParseFlagFieldInput(fieldKey, { textBody, buttonId, listReplyId }, state)
    if (!parsed.ok) {
      return sendValidationAndReask(phoneNumberId, from, parsed.errorMessage || config.validate, () =>
        sendAskForFlagField(phoneNumberId, from, state, fieldKey),
      )
    }
    conversationState.set(from, { ...parsed.stateUpdate, eventAddFlagIndex: idx + 1 })
    const nextIdx = idx + 1
    if (nextIdx >= order.length) {
      return runProcessDraftAfterFlagInput(phoneNumberId, from, conversationState.get(from), context)
    }
    return sendAskForFlagField(phoneNumberId, from, conversationState.get(from), order[nextIdx])
  }

  if (step === STEPS.EVENT_ADD_TITLE) {
    if (textBody === 'טסט') return applyEventAddTestModeAndGoToMedia(phoneNumberId, from)
    if (!textBody) return sendText(phoneNumberId, from, EVENT_ADD_ASK_TITLE)
    const len = textBody.length
    if (len < EVENT_ADD_TITLE_MIN || len > EVENT_ADD_TITLE_MAX) {
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_TITLE, () =>
        sendText(phoneNumberId, from, EVENT_ADD_ASK_TITLE),
      )
    }
    conversationState.set(from, { eventAddTitle: textBody, step: STEPS.EVENT_ADD_DATETIME })
    return sendText(phoneNumberId, from, EVENT_ADD_ASK_DATETIME + '\n' + EVENT_ADD_ASK_DATETIME_FOOTER)
  }

  if (step === STEPS.EVENT_ADD_DATETIME) {
    if (!textBody) return sendText(phoneNumberId, from, EVENT_ADD_ASK_DATETIME + '\n' + EVENT_ADD_ASK_DATETIME_FOOTER)
    if (textBody.length > EVENT_ADD_DATETIME_MAX) {
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_DATETIME, () =>
        sendText(phoneNumberId, from, EVENT_ADD_ASK_DATETIME + '\n' + EVENT_ADD_ASK_DATETIME_FOOTER),
      )
    }
    conversationState.set(from, { eventAddDateTime: textBody, step: STEPS.EVENT_ADD_MAIN_CATEGORY_GROUP })
    const groupListPayload = buildCategoryGroupListPayload()
    return sendInteractiveList(phoneNumberId, from, groupListPayload)
  }

  if (step === STEPS.EVENT_ADD_MAIN_CATEGORY_GROUP) {
    const groupListPayload = buildCategoryGroupListPayload()
    if (listReplyId && !VALID_GROUP_IDS.has(listReplyId)) {
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_MAIN_CATEGORY_GROUP, () =>
        sendInteractiveList(phoneNumberId, from, groupListPayload),
      )
    }
    if (!listReplyId) {
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_MAIN_CATEGORY_GROUP, () =>
        sendInteractiveList(phoneNumberId, from, groupListPayload),
      )
    }
    conversationState.set(from, {
      eventAddMainCategoryGroupId: listReplyId,
      step: STEPS.EVENT_ADD_MAIN_CATEGORY,
    })
    const categoryListPayload = buildCategoryListForGroup(listReplyId, { addChangeGroupRow: true })
    return sendInteractiveList(phoneNumberId, from, categoryListPayload)
  }

  if (step === STEPS.EVENT_ADD_MAIN_CATEGORY) {
    if (buttonId === EVENT_ADD_CHANGE_GROUP_BUTTON.id) {
      conversationState.set(from, { step: STEPS.EVENT_ADD_MAIN_CATEGORY_GROUP })
      const groupListPayload = buildCategoryGroupListPayload()
      return sendInteractiveList(phoneNumberId, from, groupListPayload)
    }
    const sendCategoryList = (groupId) =>
      sendInteractiveList(phoneNumberId, from, buildCategoryListForGroup(groupId, { addChangeGroupRow: true }))
    if (listReplyId && !VALID_CATEGORY_IDS.has(listReplyId)) {
      const groupId = state.eventAddMainCategoryGroupId
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_MAIN_CATEGORY, () =>
        sendCategoryList(groupId),
      )
    }
    if (!listReplyId) {
      const groupId = state.eventAddMainCategoryGroupId
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_MAIN_CATEGORY, () =>
        sendCategoryList(groupId),
      )
    }
    conversationState.set(from, {
      eventAddMainCategory: listReplyId,
      eventAddExtraCategories: [],
      step: STEPS.EVENT_ADD_PLACE_NAME,
    })
    return sendLocationIntroAndPlaceName(phoneNumberId, from)
  }

  if (step === STEPS.EVENT_ADD_EXTRA_CATEGORIES) {
    conversationState.set(from, { step: STEPS.EVENT_ADD_PLACE_NAME })
    return sendLocationIntroAndPlaceName(phoneNumberId, from)
  }

  if (step === STEPS.EVENT_ADD_PLACE_NAME) {
    if (buttonId === EVENT_ADD_SKIP_BUTTON.id) {
      conversationState.set(from, { eventAddPlaceName: '', step: STEPS.EVENT_ADD_CITY })
      return sendText(phoneNumberId, from, EVENT_ADD_ASK_CITY)
    }
    if (textBody) {
      if (textBody.length > EVENT_ADD_PLACE_NAME_MAX) {
        return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_PLACE_NAME, () =>
          sendInteractiveButtons(phoneNumberId, from, {
            body: EVENT_ADD_ASK_PLACE_NAME,
            buttons: [EVENT_ADD_SKIP_BUTTON],
          }),
        )
      }
      conversationState.set(from, { eventAddPlaceName: textBody, step: STEPS.EVENT_ADD_CITY })
      return sendText(phoneNumberId, from, EVENT_ADD_ASK_CITY)
    }
    return sendInteractiveButtons(phoneNumberId, from, {
      body: EVENT_ADD_ASK_PLACE_NAME,
      buttons: [EVENT_ADD_SKIP_BUTTON],
    })
  }

  if (step === STEPS.EVENT_ADD_CITY) {
    if (!textBody) return sendText(phoneNumberId, from, EVENT_ADD_ASK_CITY)
    if (textBody.length > EVENT_ADD_CITY_MAX) {
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_CITY, () =>
        sendText(phoneNumberId, from, EVENT_ADD_ASK_CITY),
      )
    }
    const placeName = (state.eventAddPlaceName ?? '').trim()
    conversationState.set(from, { eventAddCity: textBody, step: STEPS.EVENT_ADD_ADDRESS })
    if (placeName) {
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_ADD_ASK_ADDRESS,
        footer: EVENT_ADD_ASK_ADDRESS_FOOTER,
        buttons: [EVENT_ADD_SKIP_BUTTON],
      })
    }
    return sendText(phoneNumberId, from, EVENT_ADD_ASK_ADDRESS + '\n_' + EVENT_ADD_ASK_ADDRESS_FOOTER + '_')
  }

  if (step === STEPS.EVENT_ADD_ADDRESS) {
    const placeName = (state.eventAddPlaceName ?? '').trim()
    const addressCanSkip = !!placeName

    if (buttonId === EVENT_ADD_SKIP_BUTTON.id && addressCanSkip) {
      conversationState.set(from, {
        eventAddAddressLine1: '',
        eventAddAddressLine2: '',
        step: STEPS.EVENT_ADD_LOCATION_NOTES,
      })
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_ADD_ASK_LOCATION_NOTES,
        footer: EVENT_ADD_ASK_LOCATION_NOTES_FOOTER,
        buttons: [EVENT_ADD_SKIP_BUTTON],
      })
    }
    if (!textBody) {
      if (addressCanSkip) {
        return sendInteractiveButtons(phoneNumberId, from, {
          body: EVENT_ADD_ASK_ADDRESS,
          footer: EVENT_ADD_ASK_ADDRESS_FOOTER,
          buttons: [EVENT_ADD_SKIP_BUTTON],
        })
      }
      return sendText(phoneNumberId, from, EVENT_ADD_ASK_ADDRESS + '\n_' + EVENT_ADD_ASK_ADDRESS_FOOTER + '_')
    }
    const lines = textBody.split(/\n/).map((s) => s.trim()).filter(Boolean)
    const firstLine = (lines[0] ?? '').trim()
    if (lines.length === 0 || firstLine === '') {
      if (addressCanSkip) {
        return sendInteractiveButtons(phoneNumberId, from, {
          body: EVENT_ADD_ASK_ADDRESS,
          footer: EVENT_ADD_ASK_ADDRESS_FOOTER,
          buttons: [EVENT_ADD_SKIP_BUTTON],
        })
      }
      return sendText(phoneNumberId, from, EVENT_ADD_ASK_ADDRESS + '\n_' + EVENT_ADD_ASK_ADDRESS_FOOTER + '_')
    }
    const reaskAddress = () =>
      addressCanSkip
        ? sendInteractiveButtons(phoneNumberId, from, {
            body: EVENT_ADD_ASK_ADDRESS,
            footer: EVENT_ADD_ASK_ADDRESS_FOOTER,
            buttons: [EVENT_ADD_SKIP_BUTTON],
          })
        : sendText(phoneNumberId, from, EVENT_ADD_ASK_ADDRESS + '\n_' + EVENT_ADD_ASK_ADDRESS_FOOTER + '_')
    if (lines.length > 2) {
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_ADDRESS, reaskAddress)
    }
    const line1 = (lines[0] ?? '').trim()
    const line2 = (lines[1] ?? '').trim()
    const line1TooLong = line1.length > EVENT_ADD_ADDRESS_MAX
    const line2TooLong = line2.length > EVENT_ADD_ADDRESS_MAX
    if (line1TooLong || line2TooLong) {
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_ADDRESS, reaskAddress)
    }
    conversationState.set(from, {
      eventAddAddressLine1: line1,
      eventAddAddressLine2: line2,
      step: STEPS.EVENT_ADD_LOCATION_NOTES,
    })
    return sendInteractiveButtons(phoneNumberId, from, {
      body: EVENT_ADD_ASK_LOCATION_NOTES,
      buttons: [EVENT_ADD_SKIP_BUTTON],
    })
  }

  if (step === STEPS.EVENT_ADD_LOCATION_NOTES) {
    if (buttonId === EVENT_ADD_SKIP_BUTTON.id) {
      conversationState.set(from, { eventAddLocationNotes: '', step: STEPS.EVENT_ADD_WAZE_GMAPS })
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_ADD_ASK_WAZE_GMAPS,
        buttons: [EVENT_ADD_SKIP_BUTTON],
      })
    }
    if (textBody) {
      if (textBody.length > EVENT_ADD_LOCATION_NOTES_MAX) {
        return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_LOCATION_NOTES, () =>
          sendInteractiveButtons(phoneNumberId, from, {
            body: EVENT_ADD_ASK_LOCATION_NOTES,
            footer: EVENT_ADD_ASK_LOCATION_NOTES_FOOTER,
            buttons: [EVENT_ADD_SKIP_BUTTON],
          }),
        )
      }
      conversationState.set(from, {
        eventAddLocationNotes: textBody,
        step: STEPS.EVENT_ADD_WAZE_GMAPS,
      })
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_ADD_ASK_WAZE_GMAPS,
        buttons: [EVENT_ADD_SKIP_BUTTON],
      })
    }
    return sendInteractiveButtons(phoneNumberId, from, {
      body: EVENT_ADD_ASK_LOCATION_NOTES,
      footer: EVENT_ADD_ASK_LOCATION_NOTES_FOOTER,
      buttons: [EVENT_ADD_SKIP_BUTTON],
    })
  }

  if (step === STEPS.EVENT_ADD_WAZE_GMAPS) {
    if (buttonId === EVENT_ADD_SKIP_BUTTON.id) {
      conversationState.set(from, { eventAddNavLinks: '', step: STEPS.EVENT_ADD_PRICE })
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_ADD_ASK_PRICE,
        footer: EVENT_ADD_ASK_PRICE_FOOTER,
        buttons: [EVENT_ADD_SKIP_BUTTON],
      })
    }
    if (textBody) {
      if (textBody.length > EVENT_ADD_WAZE_GMAPS_MAX) {
        return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_WAZE_GMAPS, () =>
          sendInteractiveButtons(phoneNumberId, from, {
            body: EVENT_ADD_ASK_WAZE_GMAPS,
            buttons: [EVENT_ADD_SKIP_BUTTON],
          }),
        )
      }
      conversationState.set(from, {
        eventAddNavLinks: textBody,
        step: STEPS.EVENT_ADD_PRICE,
      })
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_ADD_ASK_PRICE,
        footer: EVENT_ADD_ASK_PRICE_FOOTER,
        buttons: [EVENT_ADD_SKIP_BUTTON],
      })
    }
    return sendInteractiveButtons(phoneNumberId, from, {
      body: EVENT_ADD_ASK_WAZE_GMAPS,
      buttons: [EVENT_ADD_SKIP_BUTTON],
    })
  }

  if (step === STEPS.EVENT_ADD_PRICE) {
    if (buttonId === EVENT_ADD_SKIP_BUTTON.id) {
      conversationState.set(from, { eventAddPrice: '', step: STEPS.EVENT_ADD_DESCRIPTION })
      return sendText(phoneNumberId, from, EVENT_ADD_ASK_DESCRIPTION)
    }
    if (textBody) {
      if (textBody.length > EVENT_ADD_PRICE_MAX) {
        return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_PRICE, () =>
          sendInteractiveButtons(phoneNumberId, from, {
            body: EVENT_ADD_ASK_PRICE,
            footer: EVENT_ADD_ASK_PRICE_FOOTER,
            buttons: [EVENT_ADD_SKIP_BUTTON],
          }),
        )
      }
      conversationState.set(from, { eventAddPrice: textBody, step: STEPS.EVENT_ADD_DESCRIPTION })
      return sendText(phoneNumberId, from, EVENT_ADD_ASK_DESCRIPTION)
    }
    return sendInteractiveButtons(phoneNumberId, from, {
      body: EVENT_ADD_ASK_PRICE,
      footer: EVENT_ADD_ASK_PRICE_FOOTER,
      buttons: [EVENT_ADD_SKIP_BUTTON],
    })
  }

  if (step === STEPS.EVENT_ADD_DESCRIPTION) {
    if (!textBody) return sendText(phoneNumberId, from, EVENT_ADD_ASK_DESCRIPTION)
    if (textBody.length < EVENT_ADD_DESCRIPTION_MIN || textBody.length > EVENT_ADD_DESCRIPTION_MAX) {
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_DESCRIPTION, () =>
        sendText(phoneNumberId, from, EVENT_ADD_ASK_DESCRIPTION),
      )
    }
    conversationState.set(from, { eventAddDescription: textBody, step: STEPS.EVENT_ADD_LINKS })
    return sendInteractiveButtons(phoneNumberId, from, {
      body: EVENT_ADD_ASK_LINKS,
      footer: EVENT_ADD_ASK_LINKS_FOOTER,
      buttons: [EVENT_ADD_SKIP_BUTTON],
    })
  }

  if (step === STEPS.EVENT_ADD_LINKS) {
    if (buttonId === EVENT_ADD_SKIP_BUTTON.id) {
      conversationState.set(from, { eventAddLinks: '', step: STEPS.EVENT_ADD_MEDIA })
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_ADD_ASK_MEDIA_FIRST,
        buttons: [EVENT_ADD_SKIP_BUTTON],
      })
    }
    if (textBody) {
      if (textBody.length > EVENT_ADD_LINKS_MAX) {
        return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_LINKS, () =>
          sendInteractiveButtons(phoneNumberId, from, {
            body: EVENT_ADD_ASK_LINKS,
            footer: EVENT_ADD_ASK_LINKS_FOOTER,
            buttons: [EVENT_ADD_SKIP_BUTTON],
          }),
        )
      }
      conversationState.set(from, { eventAddLinks: textBody, step: STEPS.EVENT_ADD_MEDIA })
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_ADD_ASK_MEDIA_FIRST,
        buttons: [EVENT_ADD_SKIP_BUTTON],
      })
    }
    return sendInteractiveButtons(phoneNumberId, from, {
      body: EVENT_ADD_ASK_LINKS,
      footer: EVENT_ADD_ASK_LINKS_FOOTER,
      buttons: [EVENT_ADD_SKIP_BUTTON],
    })
  }

  if (step === STEPS.EVENT_ADD_MEDIA) {
    if (msg.type === 'interactive' && buttonId === EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON.id) {
      if (state.eventAddConfirmPending) return Promise.resolve()
      conversationState.set(from, { eventAddConfirmPending: true })
      conversationState.set(from, { eventAddMedia: [] })
      const s = conversationState.get(from)
      return goToConfirmOrRetryMedia(phoneNumberId, from, s, context)
    }
    if ((msg.type === 'image' || msg.type === 'video') && mediaId) {
      const currentCount = (state.eventAddMedia || []).length
      if (currentCount >= MAX_MEDIA) {
        if (state.eventAddConfirmPending) return Promise.resolve()
        conversationState.set(from, { eventAddConfirmPending: true })
        const s = conversationState.get(from)
        return goToConfirmOrRetryMedia(phoneNumberId, from, s, context, { isMaxMedia: true })
      }
      const item = await processIncomingMedia(mediaId, state)
      if (!item) {
        return sendText(phoneNumberId, from, EVENT_ADD_MEDIA_UPLOAD_FAILED).then((r) => {
          if (r && !r.success) return r
          return sendInteractiveButtons(phoneNumberId, from, {
            body: EVENT_ADD_ASK_MEDIA_FIRST,
            buttons: [EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON],
          })
        })
      }
      const media = [...(state.eventAddMedia || []), item]
      conversationState.set(from, { eventAddMedia: media })
      await sendText(phoneNumberId, from, buildMediaCountMessage(media.length))
      if (media.length >= MAX_MEDIA) {
        conversationState.set(from, { eventAddConfirmPending: true })
        const s = conversationState.get(from)
        return goToConfirmOrRetryMedia(phoneNumberId, from, s, context, { isMaxMedia: true })
      }
      conversationState.set(from, { step: STEPS.EVENT_ADD_MEDIA_MORE })
      return Promise.resolve()
    }
    if (msg.type === 'text') {
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_MEDIA, () =>
        sendInteractiveButtons(phoneNumberId, from, {
          body: EVENT_ADD_ASK_MEDIA_FIRST,
          buttons: [EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON],
        }),
      )
    }
    return Promise.resolve()
  }

  if (step === STEPS.EVENT_ADD_MEDIA_MORE) {
    if (msg.type === 'interactive' && buttonId === EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON.id) {
      if (state.eventAddConfirmPending) return Promise.resolve()
      conversationState.set(from, { eventAddConfirmPending: true })
      const s = conversationState.get(from)
      return goToConfirmOrRetryMedia(phoneNumberId, from, s, context)
    }
    if ((msg.type === 'image' || msg.type === 'video') && mediaId) {
      const currentCount = (state.eventAddMedia || []).length
      if (currentCount >= MAX_MEDIA) {
        if (state.eventAddConfirmPending) return Promise.resolve()
        conversationState.set(from, { eventAddConfirmPending: true })
        const s = conversationState.get(from)
        return goToConfirmOrRetryMedia(phoneNumberId, from, s, context, { isMaxMedia: true })
      }
      const item = await processIncomingMedia(mediaId, state)
      if (!item) {
        return sendText(phoneNumberId, from, EVENT_ADD_MEDIA_UPLOAD_FAILED).then((r) => {
          if (r && !r.success) return r
          const count = (state.eventAddMedia || []).length
          return sendInteractiveButtons(phoneNumberId, from, {
            body: buildMediaMoreBody(MAX_MEDIA - count),
            buttons: [EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON],
          })
        })
      }
      const media = [...(state.eventAddMedia || []), item]
      conversationState.set(from, { eventAddMedia: media })
      await sendText(phoneNumberId, from, buildMediaCountMessage(media.length))
      if (media.length >= MAX_MEDIA) {
        conversationState.set(from, { eventAddConfirmPending: true })
        const s = conversationState.get(from)
        return goToConfirmOrRetryMedia(phoneNumberId, from, s, context, { isMaxMedia: true })
      }
      return Promise.resolve()
    }
    if (msg.type === 'text') {
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_MEDIA, () => {
        const count = (state.eventAddMedia || []).length
        return sendInteractiveButtons(phoneNumberId, from, {
          body: buildMediaMoreBody(MAX_MEDIA - count),
          buttons: [EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON],
        })
      })
    }
    return Promise.resolve()
  }

  // Fallback when step is unknown or unexpected (e.g. EVENT_ADD_INITIAL or corrupted state)
  return sendText(phoneNumberId, from, EVENT_ADD_ASK_TITLE)
}

export { isEventAddStep }

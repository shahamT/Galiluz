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
import { createEvent, formatEvent } from '../services/eventsCreate.service.js'
import { conversationState } from '../services/conversationState.service.js'
import { normalizePhone } from '../config.js'
import { logger } from '../utils/logger.js'
import {
  EVENT_ADD_INITIAL,
  EVENT_ADD_ASK_TITLE,
  EVENT_ADD_ASK_DATETIME,
  EVENT_ADD_CATEGORY_INTRO,
  EVENT_ADD_ASK_CATEGORY_GROUP,
  EVENT_ADD_ASK_MAIN_CATEGORY,
  EVENT_ADD_CATEGORY_AI_NOTE,
  EVENT_ADD_CHANGE_GROUP_PROMPT,
  EVENT_ADD_CHANGE_GROUP_BUTTON,
  EVENT_ADD_LOCATION_INTRO,
  EVENT_ADD_ASK_PLACE_NAME,
  EVENT_ADD_SKIP_BUTTON,
  EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON,
  EVENT_ADD_ASK_CITY,
  EVENT_ADD_ASK_ADDRESS,
  EVENT_ADD_ASK_LOCATION_NOTES,
  EVENT_ADD_ASK_WAZE_GMAPS,
  EVENT_ADD_ASK_PRICE,
  EVENT_ADD_ASK_DESCRIPTION,
  EVENT_ADD_ASK_LINKS,
  EVENT_ADD_ASK_MEDIA_FIRST,
  EVENT_ADD_ASK_MEDIA_MORE,
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
  EVENT_ADD_MEDIA_MAX_REACHED,
  EVENT_ADD_CONFIRM_INTRO,
  EVENT_ADD_CONFIRM_SAVE_BUTTON,
  EVENT_ADD_CONFIRM_EDIT_BUTTON,
  EVENT_ADD_CONFIRM_EDIT_RESTART,
  EVENT_ADD_FORMAT_FAILED,
  LOG_PREFIXES,
} from '../consts/index.js'
import { WELCOME_INTERACTIVE } from '../consts/index.js'
import { CATEGORY_GROUPS, EVENT_CATEGORIES } from '../consts/categories.const.js'

const VALID_CATEGORY_IDS = new Set(Object.keys(EVENT_CATEGORIES))
const VALID_GROUP_IDS = new Set(CATEGORY_GROUPS.map((g) => g.id))

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
  STEPS.EVENT_ADD_CONFIRM,
]

function isEventAddStep(step) {
  return EVENT_ADD_STEPS.includes(step)
}

function buildMediaMoreBody(mediaCount) {
  return `${EVENT_ADD_ASK_MEDIA_MORE}\n_${mediaCount}/${MAX_MEDIA} קבצים נטענו_`
}

const WHATSAPP_MESSAGE_MAX = 4096

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
  if (loc.wazeNavLink) locLines.push(`ניווט בוויז - ${loc.wazeNavLink}`)
  if (loc.gmapsNavLink) locLines.push(`ניווט בגוגל מפות - ${loc.gmapsNavLink}`)
  const locationBlock = locLines.length ? locLines.join('\n') : '-'

  const occurrences = Array.isArray(formattedEvent.occurrences) ? formattedEvent.occurrences : []
  const occLines = occurrences.map((occ) => {
    const startIso = occ.startTime ?? occ.date
    const dateStr = occ.date ? formatDateDisplay(occ.date) : (startIso ? formatDateDisplay(getDateInIsraelFromIso(startIso)) : '-')
    if (!occ.hasTime || !startIso) return `${dateStr} – כל היום`
    const startTime = getTimeInIsraelFromIso(startIso)
    const endTime = occ.endTime ? getTimeInIsraelFromIso(occ.endTime) : ''
    return endTime ? `${dateStr} ${startTime} – ${endTime}` : `${dateStr} ${startTime}`
  })
  const datesBlock = occLines.length ? occLines.join('\n') : '-'

  const priceNum = typeof formattedEvent.price === 'number' ? formattedEvent.price : NaN
  const priceStr = Number.isNaN(priceNum) ? '-' : priceNum === 0 ? 'חינם' : `${priceNum} ₪`

  const urls = Array.isArray(formattedEvent.urls) ? formattedEvent.urls : []
  const linkLines = urls
    .filter((u) => u && typeof u.Title === 'string' && typeof u.Url === 'string')
    .map((u) => (u.type === 'phone' ? `${u.Title} (טלפון) - ${u.Url}` : `${u.Title} - ${u.Url}`))
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
    otherCategories.length ? otherCategories.join(', ') : '-',
    '',
    `*מיקום האירוע:*`,
    locationBlock,
  ].join('\n')

  const part2 = [
    `*תאריכים ושעות:*`,
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
  const formatResult = await formatEvent({ rawEvent, media, mainCategory, categories })
  if (!formatResult.success || !formatResult.formattedEvent) {
    conversationState.set(from, { eventAddConfirmPending: undefined })
    await sendText(phoneNumberId, from, EVENT_ADD_FORMAT_FAILED)
    const count = (state.eventAddMedia || []).length
    const body = count === 0 ? EVENT_ADD_ASK_MEDIA_FIRST : buildMediaMoreBody(count)
    return sendInteractiveButtons(phoneNumberId, from, {
      body,
      buttons: [EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON],
    })
  }
  conversationState.set(from, {
    eventAddFormattedPreview: formatResult.formattedEvent,
    step: STEPS.EVENT_ADD_CONFIRM,
    eventAddConfirmPending: undefined,
  })
  await sendText(phoneNumberId, from, EVENT_ADD_CONFIRM_INTRO)
  const previewParts = buildEventPreviewMessage(formatResult.formattedEvent, EVENT_CATEGORIES)
  for (const part of previewParts) {
    await sendText(phoneNumberId, from, part)
  }
  return sendInteractiveButtons(phoneNumberId, from, {
    body: 'בחר/י:',
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
 * Categories in one group only (max 7 rows). Optionally exclude ids and override body.
 * @param {string} groupId - CATEGORY_GROUPS[].id
 * @param {{ excludeIds?: string[], bodyOverride?: string }} [opts]
 */
function buildCategoryListForGroup(groupId, opts = {}) {
  const group = CATEGORY_GROUPS.find((g) => g.id === groupId)
  const defaultBody = EVENT_ADD_ASK_MAIN_CATEGORY + '\n' + EVENT_ADD_CATEGORY_AI_NOTE
  if (!group) return { body: opts.bodyOverride || defaultBody, button: 'בחר קטגוריה', sections: [{ title: '', rows: [] }] }
  const excludeIds = opts.excludeIds || []
  const rows = group.categoryIds
    .filter((id) => !excludeIds.includes(id))
    .map((id) => ({ id, title: EVENT_CATEGORIES[id]?.label || id }))
  return {
    body: opts.bodyOverride || defaultBody,
    button: 'בחר קטגוריה',
    sections: [{ title: group.label, rows }],
  }
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
 * Submit event: call create API, clear state (unless keepStateForMaxMedia), send success and welcome.
 * @param {{ keepStateForMaxMedia?: boolean, formattedEvent?: object }} [opts] - keepStateForMaxMedia: do not clear so next message can show "max reached"; formattedEvent: use when user confirmed preview (skips server format)
 */
async function submitEvent(phoneNumberId, from, state, context, opts = {}) {
  const publisherInfo = {
    phone: from,
    name: context?.profileName ?? '',
    waId: from,
  }
  const rawEvent = buildRawEvent(state, publisherInfo)
  const media = Array.isArray(state.eventAddMedia) ? state.eventAddMedia : []
  const mainCategory = (state.eventAddMainCategory ?? '').trim()
  const categories = Array.isArray(state.eventAddExtraCategories) ? state.eventAddExtraCategories : []
  const body = { rawEvent, media, mainCategory, categories }
  if (opts.formattedEvent && typeof opts.formattedEvent === 'object') {
    body.formattedEvent = opts.formattedEvent
  }

  const result = await createEvent(body)
  if (!opts.keepStateForMaxMedia) {
    conversationState.clear(from)
  }

  if (result.success) {
    logger.info(LOG_PREFIXES.EVENT_ADD, 'Event created', from, result.id)
    await sendText(phoneNumberId, from, EVENT_ADD_SUCCESS)
  } else {
    logger.error(LOG_PREFIXES.EVENT_ADD, 'Event create failed', from)
    await sendText(phoneNumberId, from, 'משהו השתבש בשמירה. נסה שוב מאוחר יותר.')
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
      conversationState.clear(from)
      conversationState.set(from, { step: STEPS.EVENT_ADD_TITLE, eventAddLastActivityAt: Date.now() })
      await sendText(phoneNumberId, from, EVENT_ADD_CONFIRM_EDIT_RESTART)
      return sendText(phoneNumberId, from, EVENT_ADD_ASK_TITLE)
    }
    return sendInteractiveButtons(phoneNumberId, from, {
      body: 'בחר/י:',
      buttons: [EVENT_ADD_CONFIRM_SAVE_BUTTON, EVENT_ADD_CONFIRM_EDIT_BUTTON],
    })
  }

  if (step === STEPS.EVENT_ADD_TITLE) {
    if (!textBody) return sendText(phoneNumberId, from, EVENT_ADD_ASK_TITLE)
    const len = textBody.length
    if (len < EVENT_ADD_TITLE_MIN || len > EVENT_ADD_TITLE_MAX) {
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_TITLE, () =>
        sendText(phoneNumberId, from, EVENT_ADD_ASK_TITLE),
      )
    }
    conversationState.set(from, { eventAddTitle: textBody, step: STEPS.EVENT_ADD_DATETIME })
    return sendText(phoneNumberId, from, EVENT_ADD_ASK_DATETIME)
  }

  if (step === STEPS.EVENT_ADD_DATETIME) {
    if (!textBody) return sendText(phoneNumberId, from, EVENT_ADD_ASK_DATETIME)
    if (textBody.length > EVENT_ADD_DATETIME_MAX) {
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_DATETIME, () =>
        sendText(phoneNumberId, from, EVENT_ADD_ASK_DATETIME),
      )
    }
    conversationState.set(from, { eventAddDateTime: textBody, step: STEPS.EVENT_ADD_MAIN_CATEGORY_GROUP })
    const groupListPayload = { ...buildCategoryGroupList(), body: EVENT_ADD_CATEGORY_INTRO + '\n' + EVENT_ADD_ASK_CATEGORY_GROUP }
    return sendInteractiveList(phoneNumberId, from, groupListPayload)
  }

  if (step === STEPS.EVENT_ADD_MAIN_CATEGORY_GROUP) {
    const groupListPayload = { ...buildCategoryGroupList(), body: EVENT_ADD_CATEGORY_INTRO + '\n' + EVENT_ADD_ASK_CATEGORY_GROUP }
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
    const categoryListPayload = buildCategoryListForGroup(listReplyId)
    return sendInteractiveList(phoneNumberId, from, categoryListPayload).then((r) => {
      if (r && !r.success) return r
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_ADD_CHANGE_GROUP_PROMPT,
        buttons: [EVENT_ADD_CHANGE_GROUP_BUTTON],
      })
    })
  }

  if (step === STEPS.EVENT_ADD_MAIN_CATEGORY) {
    if (buttonId === EVENT_ADD_CHANGE_GROUP_BUTTON.id) {
      conversationState.set(from, { step: STEPS.EVENT_ADD_MAIN_CATEGORY_GROUP })
      const groupListPayload = { ...buildCategoryGroupList(), body: EVENT_ADD_CATEGORY_INTRO + '\n' + EVENT_ADD_ASK_CATEGORY_GROUP }
      return sendInteractiveList(phoneNumberId, from, groupListPayload)
    }
    const sendCategoryListThenChangeGroupButton = (groupId) =>
      sendInteractiveList(phoneNumberId, from, buildCategoryListForGroup(groupId)).then((r) => {
        if (r && !r.success) return r
        return sendInteractiveButtons(phoneNumberId, from, {
          body: EVENT_ADD_CHANGE_GROUP_PROMPT,
          buttons: [EVENT_ADD_CHANGE_GROUP_BUTTON],
        })
      })
    if (listReplyId && !VALID_CATEGORY_IDS.has(listReplyId)) {
      const groupId = state.eventAddMainCategoryGroupId
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_MAIN_CATEGORY, () =>
        sendCategoryListThenChangeGroupButton(groupId),
      )
    }
    if (!listReplyId) {
      const groupId = state.eventAddMainCategoryGroupId
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_MAIN_CATEGORY, () =>
        sendCategoryListThenChangeGroupButton(groupId),
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
        buttons: [EVENT_ADD_SKIP_BUTTON],
      })
    }
    return sendText(phoneNumberId, from, EVENT_ADD_ASK_ADDRESS)
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
        buttons: [EVENT_ADD_SKIP_BUTTON],
      })
    }
    if (!textBody) {
      if (addressCanSkip) {
        return sendInteractiveButtons(phoneNumberId, from, {
          body: EVENT_ADD_ASK_ADDRESS,
          buttons: [EVENT_ADD_SKIP_BUTTON],
        })
      }
      return sendText(phoneNumberId, from, EVENT_ADD_ASK_ADDRESS)
    }
    const lines = textBody.split(/\n/).map((s) => s.trim()).filter(Boolean)
    const firstLine = (lines[0] ?? '').trim()
    if (lines.length === 0 || firstLine === '') {
      if (addressCanSkip) {
        return sendInteractiveButtons(phoneNumberId, from, {
          body: EVENT_ADD_ASK_ADDRESS,
          buttons: [EVENT_ADD_SKIP_BUTTON],
        })
      }
      return sendText(phoneNumberId, from, EVENT_ADD_ASK_ADDRESS)
    }
    const reaskAddress = () =>
      addressCanSkip
        ? sendInteractiveButtons(phoneNumberId, from, {
            body: EVENT_ADD_ASK_ADDRESS,
            buttons: [EVENT_ADD_SKIP_BUTTON],
          })
        : sendText(phoneNumberId, from, EVENT_ADD_ASK_ADDRESS)
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
      buttons: [EVENT_ADD_SKIP_BUTTON],
    })
  }

  if (step === STEPS.EVENT_ADD_WAZE_GMAPS) {
    if (buttonId === EVENT_ADD_SKIP_BUTTON.id) {
      conversationState.set(from, { eventAddNavLinks: '', step: STEPS.EVENT_ADD_PRICE })
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_ADD_ASK_PRICE,
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
            buttons: [EVENT_ADD_SKIP_BUTTON],
          }),
        )
      }
      conversationState.set(from, { eventAddPrice: textBody, step: STEPS.EVENT_ADD_DESCRIPTION })
      return sendText(phoneNumberId, from, EVENT_ADD_ASK_DESCRIPTION)
    }
    return sendInteractiveButtons(phoneNumberId, from, {
      body: EVENT_ADD_ASK_PRICE,
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
      buttons: [EVENT_ADD_SKIP_BUTTON],
    })
  }

  if (step === STEPS.EVENT_ADD_MEDIA) {
    if (buttonId === EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON.id) {
      conversationState.set(from, { eventAddMedia: [] })
      const s = conversationState.get(from)
      return goToConfirmOrRetryMedia(phoneNumberId, from, s, context)
    }
    if (mediaId) {
      const currentCount = (state.eventAddMedia || []).length
      if (currentCount >= MAX_MEDIA) {
        if (state.eventAddConfirmPending) return Promise.resolve()
        conversationState.set(from, { eventAddConfirmPending: true })
        await sendText(phoneNumberId, from, EVENT_ADD_MEDIA_MAX_REACHED)
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
      if (media.length >= MAX_MEDIA) {
        conversationState.set(from, { eventAddConfirmPending: true })
        await sendText(phoneNumberId, from, EVENT_ADD_MEDIA_MAX_REACHED)
        const s = conversationState.get(from)
        return goToConfirmOrRetryMedia(phoneNumberId, from, s, context, { isMaxMedia: true })
      }
      conversationState.set(from, { step: STEPS.EVENT_ADD_MEDIA_MORE })
      return sendInteractiveButtons(phoneNumberId, from, {
        body: buildMediaMoreBody(media.length),
        buttons: [EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON],
      })
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
    if (buttonId === EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON.id) {
      const s = conversationState.get(from)
      return goToConfirmOrRetryMedia(phoneNumberId, from, s, context)
    }
    if (mediaId) {
      const currentCount = (state.eventAddMedia || []).length
      if (currentCount >= MAX_MEDIA) {
        if (state.eventAddConfirmPending) return Promise.resolve()
        conversationState.set(from, { eventAddConfirmPending: true })
        await sendText(phoneNumberId, from, EVENT_ADD_MEDIA_MAX_REACHED)
        const s = conversationState.get(from)
        return goToConfirmOrRetryMedia(phoneNumberId, from, s, context, { isMaxMedia: true })
      }
      const item = await processIncomingMedia(mediaId, state)
      if (!item) {
        return sendText(phoneNumberId, from, EVENT_ADD_MEDIA_UPLOAD_FAILED).then((r) => {
          if (r && !r.success) return r
          const count = (state.eventAddMedia || []).length
          return sendInteractiveButtons(phoneNumberId, from, {
            body: buildMediaMoreBody(count),
            buttons: [EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON],
          })
        })
      }
      const media = [...(state.eventAddMedia || []), item]
      conversationState.set(from, { eventAddMedia: media })
      if (media.length >= MAX_MEDIA) {
        conversationState.set(from, { eventAddConfirmPending: true })
        await sendText(phoneNumberId, from, EVENT_ADD_MEDIA_MAX_REACHED)
        const s = conversationState.get(from)
        return goToConfirmOrRetryMedia(phoneNumberId, from, s, context, { isMaxMedia: true })
      }
      return sendInteractiveButtons(phoneNumberId, from, {
        body: buildMediaMoreBody(media.length),
        buttons: [EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON],
      })
    }
    if (msg.type === 'text') {
      return sendValidationAndReask(phoneNumberId, from, EVENT_ADD_VALIDATE_MEDIA, () =>
        sendInteractiveButtons(phoneNumberId, from, {
          body: buildMediaMoreBody((state.eventAddMedia || []).length),
          buttons: [EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON],
        }),
      )
    }
    return Promise.resolve()
  }

  // Fallback when step is unknown or unexpected (e.g. EVENT_ADD_INITIAL or corrupted state)
  return sendText(phoneNumberId, from, EVENT_ADD_ASK_TITLE)
}

export { isEventAddStep }

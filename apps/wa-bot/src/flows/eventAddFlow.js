import {
  sendText,
  sendInteractiveButtons,
  sendInteractiveList,
  downloadMedia,
} from '../services/cloudApi.service.js'
import { uploadMediaToApp } from '../services/eventAddMedia.service.js'
import { createEvent } from '../services/eventsCreate.service.js'
import { conversationState } from '../services/conversationState.service.js'
import { normalizePhone } from '../config.js'
import {
  EVENT_ADD_INITIAL,
  EVENT_ADD_ASK_TITLE,
  EVENT_ADD_ASK_DATETIME,
  EVENT_ADD_ASK_MAIN_CATEGORY,
  EVENT_ADD_ASK_EXTRA_CATEGORIES,
  EVENT_ADD_EXTRA_CAT_BUTTON,
  EVENT_ADD_CONTINUE_BUTTON,
  EVENT_ADD_LOCATION_INTRO,
  EVENT_ADD_ASK_PLACE_NAME,
  EVENT_ADD_SKIP_BUTTON,
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
} from '../consts/index.js'
import { WELCOME_INTERACTIVE } from '../consts/index.js'
import { CATEGORY_GROUPS, EVENT_CATEGORIES } from '../consts/categories.const.js'

const STEPS = conversationState.STEPS
const MAX_EXTRA_CATEGORIES = 3
const MAX_MEDIA = 5

const EVENT_ADD_STEPS = [
  STEPS.EVENT_ADD_INITIAL,
  STEPS.EVENT_ADD_TITLE,
  STEPS.EVENT_ADD_DATETIME,
  STEPS.EVENT_ADD_MAIN_CATEGORY,
  STEPS.EVENT_ADD_EXTRA_CATEGORIES,
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
]

function isEventAddStep(step) {
  return EVENT_ADD_STEPS.includes(step)
}

function buildMainCategoryList() {
  const sections = CATEGORY_GROUPS.map((group) => ({
    title: group.label,
    rows: group.categoryIds.map((id) => ({
      id,
      title: EVENT_CATEGORIES[id]?.label || id,
    })),
  }))
  return {
    body: EVENT_ADD_ASK_MAIN_CATEGORY,
    button: 'בחר קטגוריה',
    sections,
  }
}

/**
 * Build rawEvent object for create API (publisherId is set by API).
 * @param {object} state - conversation state
 * @param {{ phone?: string, name?: string, waId?: string }} publisherInfo - from/context
 */
function buildRawEvent(state, publisherInfo) {
  const phone = normalizePhone(publisherInfo?.phone ?? '')
  const name = (publisherInfo?.name ?? '').trim()
  const waId = String(publisherInfo?.waId ?? '')
  return {
    title: (state.eventAddTitle ?? '').trim(),
    dateTimeRaw: (state.eventAddDateTime ?? '').trim(),
    placeName: (state.eventAddPlaceName ?? '').trim() || undefined,
    city: (state.eventAddCity ?? '').trim(),
    addressLine1: (state.eventAddAddressLine1 ?? '').trim() || undefined,
    addressLine2: (state.eventAddAddressLine2 ?? '').trim() || undefined,
    locationNotes: (state.eventAddLocationNotes ?? '').trim() || undefined,
    wazeNavLink: (state.eventAddWazeLink ?? '').trim() || undefined,
    gmapsNavLink: (state.eventAddGmapsLink ?? '').trim() || undefined,
    price: (state.eventAddPrice ?? '').trim() || undefined,
    description: (state.eventAddDescription ?? '').trim(),
    linksText: (state.eventAddLinks ?? '').trim() || undefined,
    publisher: { phone, name, waId },
  }
}

/**
 * Send initial event-add message and ask title. Call after setting step to EVENT_ADD_INITIAL.
 */
export function sendInitialMessage(phoneNumberId, from) {
  conversationState.set(from, { step: STEPS.EVENT_ADD_TITLE })
  return sendText(phoneNumberId, from, EVENT_ADD_INITIAL).then((r) => {
    if (r && !r.success) return r
    return sendText(phoneNumberId, from, EVENT_ADD_ASK_TITLE)
  })
}

/**
 * Submit event: call create API, clear state, send success and welcome.
 */
async function submitEvent(phoneNumberId, from, state, context) {
  const publisherInfo = {
    phone: from,
    name: context?.profileName ?? '',
    waId: from,
  }
  const rawEvent = buildRawEvent(state, publisherInfo)
  const media = Array.isArray(state.eventAddMedia) ? state.eventAddMedia : []
  const mainCategory = (state.eventAddMainCategory ?? '').trim()
  const categories = Array.isArray(state.eventAddExtraCategories) ? state.eventAddExtraCategories : []

  const result = await createEvent({ rawEvent, media, mainCategory, categories })
  conversationState.clear(from)

  await sendText(phoneNumberId, from, EVENT_ADD_SUCCESS)
  if (!result.success) {
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

  if (buttonId === 'back_to_main' || buttonId === 'back_to_menu') {
    conversationState.clear(from)
    return sendInteractiveButtons(phoneNumberId, from, WELCOME_INTERACTIVE)
  }

  if (step === STEPS.EVENT_ADD_TITLE) {
    if (!textBody) return sendText(phoneNumberId, from, EVENT_ADD_ASK_TITLE)
    conversationState.set(from, { eventAddTitle: textBody, step: STEPS.EVENT_ADD_DATETIME })
    return sendText(phoneNumberId, from, EVENT_ADD_ASK_DATETIME)
  }

  if (step === STEPS.EVENT_ADD_DATETIME) {
    if (!textBody) return sendText(phoneNumberId, from, EVENT_ADD_ASK_DATETIME)
    conversationState.set(from, { eventAddDateTime: textBody, step: STEPS.EVENT_ADD_MAIN_CATEGORY })
    return sendInteractiveList(phoneNumberId, from, buildMainCategoryList())
  }

  if (step === STEPS.EVENT_ADD_MAIN_CATEGORY) {
    if (!listReplyId) return sendInteractiveList(phoneNumberId, from, buildMainCategoryList())
    conversationState.set(from, {
      eventAddMainCategory: listReplyId,
      eventAddExtraCategories: [],
      step: STEPS.EVENT_ADD_EXTRA_CATEGORIES,
    })
    return sendInteractiveButtons(phoneNumberId, from, {
      body: EVENT_ADD_ASK_EXTRA_CATEGORIES,
      buttons: [EVENT_ADD_EXTRA_CAT_BUTTON, EVENT_ADD_CONTINUE_BUTTON],
    })
  }

  if (step === STEPS.EVENT_ADD_EXTRA_CATEGORIES) {
    if (buttonId === EVENT_ADD_CONTINUE_BUTTON.id) {
      conversationState.set(from, { step: STEPS.EVENT_ADD_PLACE_NAME })
      await sendText(phoneNumberId, from, EVENT_ADD_LOCATION_INTRO)
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_ADD_ASK_PLACE_NAME,
        buttons: [EVENT_ADD_SKIP_BUTTON],
      })
    }
    if (buttonId === EVENT_ADD_EXTRA_CAT_BUTTON.id) {
      const extras = state.eventAddExtraCategories || []
      if (extras.length >= MAX_EXTRA_CATEGORIES) {
        conversationState.set(from, { step: STEPS.EVENT_ADD_PLACE_NAME })
        await sendText(phoneNumberId, from, EVENT_ADD_LOCATION_INTRO)
        return sendInteractiveButtons(phoneNumberId, from, {
          body: EVENT_ADD_ASK_PLACE_NAME,
          buttons: [EVENT_ADD_SKIP_BUTTON],
        })
      }
      return sendInteractiveList(phoneNumberId, from, buildMainCategoryList())
    }
    if (listReplyId) {
      const mainId = state.eventAddMainCategory
      const extras = state.eventAddExtraCategories || []
      if (mainId !== listReplyId && !extras.includes(listReplyId) && extras.length < MAX_EXTRA_CATEGORIES) {
        const nextExtras = [...extras, listReplyId]
        conversationState.set(from, { eventAddExtraCategories: nextExtras })
        if (nextExtras.length >= MAX_EXTRA_CATEGORIES) {
          conversationState.set(from, { step: STEPS.EVENT_ADD_PLACE_NAME })
          await sendText(phoneNumberId, from, EVENT_ADD_LOCATION_INTRO)
          return sendInteractiveButtons(phoneNumberId, from, {
            body: EVENT_ADD_ASK_PLACE_NAME,
            buttons: [EVENT_ADD_SKIP_BUTTON],
          })
        }
      }
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_ADD_ASK_EXTRA_CATEGORIES,
        buttons: [EVENT_ADD_EXTRA_CAT_BUTTON, EVENT_ADD_CONTINUE_BUTTON],
      })
    }
    return sendInteractiveButtons(phoneNumberId, from, {
      body: EVENT_ADD_ASK_EXTRA_CATEGORIES,
      buttons: [EVENT_ADD_EXTRA_CAT_BUTTON, EVENT_ADD_CONTINUE_BUTTON],
    })
  }

  if (step === STEPS.EVENT_ADD_PLACE_NAME) {
    if (buttonId === EVENT_ADD_SKIP_BUTTON.id) {
      conversationState.set(from, { eventAddPlaceName: '', step: STEPS.EVENT_ADD_CITY })
      return sendText(phoneNumberId, from, EVENT_ADD_ASK_CITY)
    }
    if (textBody) {
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
    conversationState.set(from, { eventAddCity: textBody, step: STEPS.EVENT_ADD_ADDRESS })
    const placeName = (state.eventAddPlaceName ?? '').trim()
    if (placeName) {
      conversationState.set(from, { step: STEPS.EVENT_ADD_LOCATION_NOTES })
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_ADD_ASK_LOCATION_NOTES,
        buttons: [EVENT_ADD_SKIP_BUTTON],
      })
    }
    return sendText(phoneNumberId, from, EVENT_ADD_ASK_ADDRESS)
  }

  if (step === STEPS.EVENT_ADD_ADDRESS) {
    if (!textBody) return sendText(phoneNumberId, from, EVENT_ADD_ASK_ADDRESS)
    const lines = textBody.split(/\n/).map((s) => s.trim()).filter(Boolean)
    conversationState.set(from, {
      eventAddAddressLine1: lines[0] ?? '',
      eventAddAddressLine2: lines[1] ?? '',
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
    if (textBody || buttonId) {
      conversationState.set(from, {
        eventAddLocationNotes: textBody || '',
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
      conversationState.set(from, { eventAddWazeLink: '', eventAddGmapsLink: '', step: STEPS.EVENT_ADD_PRICE })
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_ADD_ASK_PRICE,
        buttons: [EVENT_ADD_SKIP_BUTTON],
      })
    }
    if (textBody || buttonId) {
      conversationState.set(from, {
        eventAddWazeLink: textBody || '',
        eventAddGmapsLink: textBody || '',
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
    if (textBody || buttonId) {
      conversationState.set(from, { eventAddPrice: textBody || '', step: STEPS.EVENT_ADD_DESCRIPTION })
      return sendText(phoneNumberId, from, EVENT_ADD_ASK_DESCRIPTION)
    }
    return sendInteractiveButtons(phoneNumberId, from, {
      body: EVENT_ADD_ASK_PRICE,
      buttons: [EVENT_ADD_SKIP_BUTTON],
    })
  }

  if (step === STEPS.EVENT_ADD_DESCRIPTION) {
    if (!textBody) return sendText(phoneNumberId, from, EVENT_ADD_ASK_DESCRIPTION)
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
    if (textBody || buttonId) {
      conversationState.set(from, { eventAddLinks: textBody || '', step: STEPS.EVENT_ADD_MEDIA })
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
    if (buttonId === EVENT_ADD_SKIP_BUTTON.id) {
      conversationState.set(from, { eventAddMedia: [], step: STEPS.EVENT_ADD_MEDIA_MORE })
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_ADD_ASK_MEDIA_MORE,
        buttons: [EVENT_ADD_SKIP_BUTTON],
      })
    }
    if (mediaId) {
      const item = await processIncomingMedia(mediaId, state)
      if (!item) return sendText(phoneNumberId, from, 'לא הצלחתי לקבל את הקובץ. נסה שוב.')
      const media = [...(state.eventAddMedia || []), item]
      conversationState.set(from, { eventAddMedia: media })
      if (media.length >= MAX_MEDIA) {
        const s = conversationState.get(from)
        return submitEvent(phoneNumberId, from, s, context)
      }
      conversationState.set(from, { step: STEPS.EVENT_ADD_MEDIA_MORE })
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_ADD_ASK_MEDIA_MORE,
        buttons: [EVENT_ADD_SKIP_BUTTON],
      })
    }
    return sendInteractiveButtons(phoneNumberId, from, {
      body: EVENT_ADD_ASK_MEDIA_FIRST,
      buttons: [EVENT_ADD_SKIP_BUTTON],
    })
  }

  if (step === STEPS.EVENT_ADD_MEDIA_MORE) {
    if (buttonId === EVENT_ADD_SKIP_BUTTON.id) {
      const s = conversationState.get(from)
      return submitEvent(phoneNumberId, from, s, context)
    }
    if (mediaId) {
      const item = await processIncomingMedia(mediaId, state)
      if (!item) return sendText(phoneNumberId, from, 'לא הצלחתי לקבל את הקובץ. נסה שוב.')
      const media = [...(state.eventAddMedia || []), item]
      conversationState.set(from, { eventAddMedia: media })
      if (media.length >= MAX_MEDIA) {
        const s = conversationState.get(from)
        return submitEvent(phoneNumberId, from, s, context)
      }
      return sendInteractiveButtons(phoneNumberId, from, {
        body: EVENT_ADD_ASK_MEDIA_MORE,
        buttons: [EVENT_ADD_SKIP_BUTTON],
      })
    }
    return sendInteractiveButtons(phoneNumberId, from, {
      body: EVENT_ADD_ASK_MEDIA_MORE,
      buttons: [EVENT_ADD_SKIP_BUTTON],
    })
  }

  return sendText(phoneNumberId, from, EVENT_ADD_ASK_TITLE)
}

export { isEventAddStep }

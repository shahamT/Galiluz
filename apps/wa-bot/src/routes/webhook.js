import { config, normalizePhone } from '../config.js'
import {
  sendText,
  sendInteractiveButtons,
  sendInteractiveList,
  sendTemplate,
  REENGAGEMENT_ERROR_CODE,
} from '../services/cloudApi.service.js'
import { conversationState } from '../services/conversationState.service.js'
import { getEventsMessageForDateAndCategory, getDateIsrael } from '../services/eventsDiscovery.service.js'
import { logger } from '../utils/logger.js'
import {
  LOG_PREFIXES,
  WELCOME,
  CONTACT,
  DISCOVER,
  PUBLISH,
  APPROVER,
  PUBLISHER,
  EVENT_LIST,
  EVENT_ADD,
  MAIN_MENU,
  BATCH_FLUSH_MS,
} from '../consts/index.js'
import {
  sendInitialMessage,
  sendEventAddMethodChoice,
  handleEventAddFlow,
  isEventAddStep,
  sendMediaMoreMessageIfNeeded,
} from '../flows/eventAddFlow.js'
import { buildEditMenuFirstMessagePayload, buildPublisherEventListPayload } from '../flows/eventEditFlow.js'
import { getEventsByPublisher, getEventById, deleteEvent } from '../services/eventsCreate.service.js'
import {
  checkPublisher,
  registerPublisher,
  approvePublisher,
  rejectPublisher,
} from '../services/publishers.service.js'
import { CATEGORY_GROUPS, CATEGORY_ALL_ID } from '../consts/categories.const.js'
import { CITIES_LIST } from '../consts/cities.const.js'
import {
  getPhoneNumberId,
  shouldForwardToDev,
  forwardToDev,
} from '../utils/whatsappWebhookRouter.js'
import { verifyWebhookSignature } from '../utils/webhookSignature.js'
import { classifyMainMenuIntent } from '../services/mainMenuIntent.service.js'

/** In-memory: approver waId -> (publisher waId -> fullName) for confirmation messages */
const pendingPublisherNamesByApprover = new Map()

/** When we send approver request we store messageId -> approverWaId so on status failed 131047 we can send template. */
const messageIdToApproverWaId = new Map()

/** Payload of the approver request per messageId; on 131047 we move it to pendingApproverRequestByApprover so when approver replies we send the buttons. */
const lastApproverRequestPayloadByMessageId = new Map()

/** Set only after 131047 + template send: when approver replies (non-button) we send all queued approval UIs. approverWaId -> Array<{ publisherWaId, fullName, body, buttons }> */
const pendingApproverRequestByApprover = new Map()

/** Log APP_SECRET warning only once per process to avoid log spam. */
let hasWarnedNoAppSecret = false

function getAndRemovePublisherName(approverFrom, publisherWaId) {
  const normalized = normalizePhone(approverFrom)
  const byWaId = pendingPublisherNamesByApprover.get(normalized)
  const fullName = byWaId?.get(publisherWaId)
  if (byWaId) {
    byWaId.delete(publisherWaId)
    if (byWaId.size === 0) pendingPublisherNamesByApprover.delete(normalized)
  }
  return fullName || PUBLISH.DEFAULT_PUBLISHER_LABEL
}

function storePublisherNameForApprover(approverWaId, publisherWaId, fullName) {
  let byWaId = pendingPublisherNamesByApprover.get(approverWaId)
  if (!byWaId) {
    byWaId = new Map()
    pendingPublisherNamesByApprover.set(approverWaId, byWaId)
  }
  byWaId.set(publisherWaId, fullName || PUBLISH.DEFAULT_PUBLISHER_LABEL)
}

/**
 * Returns true if the message is from a private chat (not a group).
 * Button/list replies include context (reply-to our message); context.id is then the message id.
 * Only group messages have context.id as a group JID (ending with @g.us).
 */
function isPrivateMessage(message) {
  const ctxId = message.context?.id
  if (!ctxId) return true
  return typeof ctxId !== 'string' || !ctxId.endsWith('@g.us')
}

/**
 * Normalize event from GET /api/events/[id] (frontend shape) to edit-flow shape (Title, location.city).
 * API returns resolved city (display name for listed); edit flow needs canonical city (id when listed).
 * @param {Record<string, unknown>} loaded
 * @returns {Record<string, unknown>}
 */
function normalizeLoadedEventForEdit(loaded) {
  if (!loaded || typeof loaded !== 'object') return {}
  const loc = loaded.location && typeof loaded.location === 'object' ? loaded.location : {}
  let city = loc.city ?? ''
  if (loc.cityType === 'listed' && city) {
    const entry = CITIES_LIST.find((c) => c.title === city)
    if (entry) city = entry.id
  }
  return {
    ...loaded,
    Title: loaded.Title ?? loaded.title ?? '',
    location: {
      ...loc,
      city,
    },
  }
}

/** Category list for discover flow: הכל first, then 4 groups */
const DISCOVER_CATEGORY_LIST = {
  body: DISCOVER.ASK_CATEGORY,
  button: DISCOVER.CATEGORY_LIST_BUTTON,
  sections: [
    {
      title: DISCOVER.CATEGORY_LIST_SECTION_TITLE,
      rows: [
        { id: CATEGORY_ALL_ID, title: DISCOVER.CATEGORY_LIST_ALL_TITLE },
        ...CATEGORY_GROUPS.map((g) => ({ id: g.id, title: g.label })),
      ],
    },
  ],
}

function handleDiscoverButton(phoneNumberId, from) {
  conversationState.set(from, { step: conversationState.STEPS.DISCOVER_CATEGORY })
  return sendInteractiveList(phoneNumberId, from, DISCOVER_CATEGORY_LIST)
}

function handleDiscoverListReply(phoneNumberId, from, listReplyId) {
  conversationState.set(from, { step: conversationState.STEPS.DISCOVER_TIME, categoryGroupId: listReplyId })
  return sendInteractiveButtons(phoneNumberId, from, DISCOVER.ASK_TIME)
}

function handleDiscoverTimeChoice(phoneNumberId, from, timeChoice) {
  const state = conversationState.get(from)
  const categoryGroupId = state.categoryGroupId || CATEGORY_ALL_ID
  const prevSearched = state.discoverSearchedTimesByCategory?.[categoryGroupId] || []
  const searchedTimesForCategory = [...new Set([...prevSearched, timeChoice])]
  const dateString = getDateIsrael(timeChoice)
  return getEventsMessageForDateAndCategory(dateString, categoryGroupId, timeChoice)
    .then((messageBody) => sendText(phoneNumberId, from, messageBody))
    .then((result) => {
      if (result?.success) {
        const nextSearchedByCategory = {
          ...(state.discoverSearchedTimesByCategory || {}),
          [categoryGroupId]: searchedTimesForCategory,
        }
        conversationState.set(from, {
          step: conversationState.STEPS.DISCOVER_AFTER_LIST,
          categoryGroupId,
          timeChoice,
          discoverSearchedTimesByCategory: nextSearchedByCategory,
        })
        return sendInteractiveButtons(
          phoneNumberId,
          from,
          DISCOVER.getAfterListPayload(timeChoice, searchedTimesForCategory),
        )
      }
      return result
    })
}

async function handleEventUpdateChoice(phoneNumberId, from) {
  const { events, error } = await getEventsByPublisher(from)
  if (error || !events || events.length === 0) {
    conversationState.clear(from)
    return sendInteractiveButtons(phoneNumberId, from, {
      body: error ? EVENT_LIST.FETCH_ERROR : EVENT_LIST.NO_FUTURE_EVENTS,
      buttons: EVENT_LIST.NO_EVENTS_BUTTONS,
    })
  }
  conversationState.set(from, {
    step: conversationState.STEPS.EVENT_UPDATE_SELECT_EVENT,
    eventUpdateList: events,
    eventUpdateListOffset: 0,
  })
  const payload = buildPublisherEventListPayload(events, 0, EVENT_LIST.UPDATE_SELECT_BODY, 'ev_up_')
  return sendInteractiveList(phoneNumberId, from, payload)
}

async function handleEventDeleteChoice(phoneNumberId, from) {
  const { events, error } = await getEventsByPublisher(from)
  if (error || !events || events.length === 0) {
    conversationState.clear(from)
    return sendInteractiveButtons(phoneNumberId, from, {
      body: error ? EVENT_LIST.FETCH_ERROR : EVENT_LIST.NO_FUTURE_EVENTS,
      buttons: EVENT_LIST.NO_EVENTS_BUTTONS,
    })
  }
  conversationState.set(from, {
    step: conversationState.STEPS.EVENT_DELETE_SELECT_EVENT,
    eventDeleteList: events,
    eventDeleteListOffset: 0,
  })
  const payload = buildPublisherEventListPayload(events, 0, EVENT_LIST.DELETE_SELECT_BODY, 'ev_del_')
  return sendInteractiveList(phoneNumberId, from, payload)
}

async function handlePublishButton(phoneNumberId, from, profileName) {
  const result = await checkPublisher(from)
  if (result.connectionError) {
    return sendInteractiveButtons(phoneNumberId, from, PUBLISH.CONNECTION_ERROR)
  }
  const { status } = result
  if (status === 'approved') {
    conversationState.set(from, { step: conversationState.STEPS.PUBLISHER_CHOOSE_ACTION })
    return sendInteractiveButtons(phoneNumberId, from, PUBLISHER.HOW_TO_CONTINUE)
  }
  if (status === 'pending') {
    return sendText(phoneNumberId, from, PUBLISH.PENDING_MESSAGE)
  }
  return sendInteractiveButtons(phoneNumberId, from, PUBLISH.NOT_REGISTERED)
}

function handleBackToMenu(phoneNumberId, from) {
  conversationState.clear(from)
  conversationState.set(from, { step: conversationState.STEPS.WELCOME, welcomeShown: true })
  return sendInteractiveButtons(phoneNumberId, from, WELCOME.MAIN_MENU_RETURN)
}

function handlePublishSignMeUp(phoneNumberId, from, profileName) {
  conversationState.set(from, {
    step: conversationState.STEPS.PUBLISH_ASK_FULL_NAME,
    ...(profileName && { profileName }),
  })
  return sendText(phoneNumberId, from, PUBLISH.ASK_FULL_NAME)
}

function handlePublishCommitNo(phoneNumberId, from) {
  conversationState.clear(from)
  return sendInteractiveButtons(phoneNumberId, from, PUBLISH.NOT_REGISTERED)
}

async function handlePublishCommitYes(phoneNumberId, from) {
  const state = conversationState.get(from)
  const waId = from
  const profileName = state.profileName || undefined
  const fullName = state.fullName || ''
  const publishingAs = state.publishingAs || ''
  const eventTypesDescription = state.eventTypesDescription || ''
  conversationState.clear(from)
  const result = await registerPublisher({
    waId,
    profileName,
    fullName,
    publishingAs,
    eventTypesDescription,
  })
  if (!result.success) {
    return sendText(phoneNumberId, from, PUBLISH.REGISTER_ERROR)
  }
  const thankYouPromise = sendInteractiveButtons(phoneNumberId, from, PUBLISH.THANK_YOU)
  const approverWaId = config.publishersApproverWaNumber
    ? normalizePhone(config.publishersApproverWaNumber)
    : ''
  if (approverWaId) {
    storePublisherNameForApprover(approverWaId, waId, fullName)
    const body = APPROVER.REQUEST_BODY_TEMPLATE.replace('{fullName}', fullName)
      .replace('{publishingAs}', publishingAs)
      .replace('{eventTypes}', eventTypesDescription)
      .replace('{waId}', waId)
    const buttons = [
      { id: APPROVER.BUTTONS.approve.idPrefix + waId, title: APPROVER.BUTTONS.approve.title },
      { id: APPROVER.BUTTONS.reject.idPrefix + waId, title: APPROVER.BUTTONS.reject.title },
      {
        id: APPROVER.BUTTONS.rejectNoReason.idPrefix + waId,
        title: APPROVER.BUTTONS.rejectNoReason.title,
      },
    ]
    const sendResult = await sendInteractiveButtons(phoneNumberId, approverWaId, { body, buttons })
    if (sendResult.success && sendResult.messageId) {
      messageIdToApproverWaId.set(sendResult.messageId, approverWaId)
      lastApproverRequestPayloadByMessageId.set(sendResult.messageId, {
        approverWaId,
        body,
        buttons,
        publisherWaId: waId,
        fullName,
      })
    }
    if (!sendResult.success) {
      logger.error(LOG_PREFIXES.WEBHOOK, 'Notify approver failed', sendResult.error)
    }
  }
  return thankYouPromise
}

async function handleApproverFlow(phoneNumberId, from, msg) {
  const approverNorm = normalizePhone(from)
  const pendingList = pendingApproverRequestByApprover.get(approverNorm)
  const isButtonReply = msg.interactive?.type === 'button_reply'
  if (pendingList && pendingList.length > 0 && !isButtonReply) {
    pendingApproverRequestByApprover.delete(approverNorm)
    let lastPromise = Promise.resolve()
    for (const pending of pendingList) {
      lastPromise = lastPromise.then(() =>
        sendInteractiveButtons(phoneNumberId, from, {
          body: pending.body,
          buttons: pending.buttons,
        }),
      )
    }
    return lastPromise
  }

  const state = conversationState.get(from)
  const interactive = msg.interactive

  if (interactive?.type === 'button_reply') {
    const id = interactive.button_reply?.id || ''
    if (id.startsWith('approve_')) {
      const waId = id.slice(8)
      const fullName = getAndRemovePublisherName(from, waId)
      const ok = await approvePublisher(waId)
      conversationState.clear(from)
      if (ok.success) {
        await sendInteractiveButtons(phoneNumberId, waId, {
          body: PUBLISHER.APPROVED.body,
          buttons: PUBLISHER.APPROVED.buttons,
        })
      }
      await sendText(
        phoneNumberId,
        from,
        APPROVER.CONFIRM_APPROVED.replace('{fullName}', fullName),
      )
      return
    }
    if (id.startsWith('reject_no_reason_')) {
      const waId = id.slice(17)
      const fullName = getAndRemovePublisherName(from, waId)
      await rejectPublisher(waId)
      conversationState.clear(from)
      const rejectedBody = `${PUBLISHER.REJECTED_BODY}\n\n${PUBLISHER.REJECTED_FOOTER}`
      await sendInteractiveButtons(phoneNumberId, waId, {
        body: rejectedBody,
        buttons: [PUBLISHER.REJECTED_BUTTON],
      })
      await sendText(
        phoneNumberId,
        from,
        APPROVER.CONFIRM_REJECTED.replace('{fullName}', fullName),
      )
      return
    }
    if (id.startsWith('reject_')) {
      const waId = id.slice(7)
      conversationState.set(from, {
        step: conversationState.STEPS.APPROVER_WAITING_REASON,
        publisherWaId: waId,
      })
      return sendInteractiveButtons(phoneNumberId, from, {
        body: APPROVER.ASK_REASON.body,
        buttons: [
          {
            id: APPROVER.ASK_REASON.noReasonButton.idPrefix + waId,
            title: APPROVER.ASK_REASON.noReasonButton.title,
          },
        ],
      })
    }
    if (id.startsWith('no_reason_')) {
      const waId = id.slice(10)
      const fullName = getAndRemovePublisherName(from, waId)
      await rejectPublisher(waId)
      conversationState.clear(from)
      const rejectedBody = `${PUBLISHER.REJECTED_BODY}\n\n${PUBLISHER.REJECTED_FOOTER}`
      await sendInteractiveButtons(phoneNumberId, waId, {
        body: rejectedBody,
        buttons: [PUBLISHER.REJECTED_BUTTON],
      })
      await sendText(
        phoneNumberId,
        from,
        APPROVER.CONFIRM_REJECTED.replace('{fullName}', fullName),
      )
      return
    }
  }

  if (msg.type === 'text' && msg.text?.body && state.step === conversationState.STEPS.APPROVER_WAITING_REASON) {
    const waId = state.publisherWaId
    const reason = String(msg.text.body).trim()
    if (waId) {
      const fullName = getAndRemovePublisherName(from, waId)
      await rejectPublisher(waId, reason)
      conversationState.clear(from)
      const body = reason
        ? `${PUBLISHER.REJECTED_BODY}\n${PUBLISHER.REJECTED_REASON_LINE}${reason}\n\n${PUBLISHER.REJECTED_FOOTER}`
        : `${PUBLISHER.REJECTED_BODY}\n\n${PUBLISHER.REJECTED_FOOTER}`
      await sendInteractiveButtons(phoneNumberId, waId, {
        body,
        buttons: [PUBLISHER.REJECTED_BUTTON],
      })
      await sendText(
        phoneNumberId,
        from,
        APPROVER.CONFIRM_REJECTED.replace('{fullName}', fullName),
      )
      return
    }
  }

  conversationState.set(from, { step: conversationState.STEPS.WELCOME, welcomeShown: true })
  return sendInteractiveButtons(phoneNumberId, from, WELCOME.MAIN_MENU_RETURN)
}

async function processOneMessage(phoneNumberId, from, msg, context = {}) {
  const approverWaId = config.publishersApproverWaNumber
    ? normalizePhone(config.publishersApproverWaNumber)
    : ''
  if (approverWaId && normalizePhone(from) === approverWaId) {
    return handleApproverFlow(phoneNumberId, from, msg)
  }

  const interactive = msg.interactive
  const state = conversationState.get(from)
  const profileName = context.profileName

  if (isEventAddStep(state.step)) {
    return handleEventAddFlow(phoneNumberId, from, msg, state, { profileName })
  }

  if (interactive?.type === 'button_reply') {
    const id = interactive.button_reply?.id
    if (id === 'discover') {
      return handleDiscoverButton(phoneNumberId, from)
    }
    if (id === 'publish') {
      return handlePublishButton(phoneNumberId, from, profileName)
    }
    if (id === 'contact') {
      return sendText(phoneNumberId, from, CONTACT.MESSAGE)
    }
    if (id === 'back_to_menu' || id === 'back_to_main') {
      return handleBackToMenu(phoneNumberId, from)
    }
    if (id === 'event_add_new') {
      if (state.step === conversationState.STEPS.EVENT_ADD_SUCCESS) {
        conversationState.clear(from)
      }
      const { status } = await checkPublisher(from)
      if (status === 'approved') {
        return sendEventAddMethodChoice(phoneNumberId, from)
      }
      return handlePublishButton(phoneNumberId, from, profileName)
    }
    if (state.step === conversationState.STEPS.PUBLISHER_CHOOSE_ACTION) {
      if (id === 'event_update') {
        return handleEventUpdateChoice(phoneNumberId, from)
      }
      if (id === 'event_delete') {
        return handleEventDeleteChoice(phoneNumberId, from)
      }
    }
    if (id === 'publish_sign_me_up') {
      return handlePublishSignMeUp(phoneNumberId, from, profileName)
    }
    if (id === 'publish_commit_no') {
      return handlePublishCommitNo(phoneNumberId, from)
    }
    if (id === 'publish_commit_yes' && state.step === conversationState.STEPS.PUBLISH_ASK_COMMITMENT) {
      return handlePublishCommitYes(phoneNumberId, from)
    }
    if (
      (id === 'today' || id === 'tomorrow') &&
      (state.step === conversationState.STEPS.DISCOVER_TIME ||
        state.step === conversationState.STEPS.DISCOVER_AFTER_LIST)
    ) {
      return handleDiscoverTimeChoice(phoneNumberId, from, id)
    }
  }

  if (interactive?.type === 'list_reply' && state.step === conversationState.STEPS.DISCOVER_CATEGORY) {
    const listReplyId = interactive.list_reply?.id
    if (listReplyId) return handleDiscoverListReply(phoneNumberId, from, listReplyId)
  }

  if (interactive?.type === 'list_reply') {
    const listReplyId = interactive.list_reply?.id || ''
    if (state.step === conversationState.STEPS.EVENT_UPDATE_SELECT_EVENT) {
      if (listReplyId.startsWith('event_list_more_')) {
        const nextOffset = parseInt(listReplyId.slice('event_list_more_'.length), 10)
        if (!Number.isNaN(nextOffset)) {
          conversationState.set(from, { eventUpdateListOffset: nextOffset })
          const list = state.eventUpdateList || []
          const payload = buildPublisherEventListPayload(list, nextOffset, EVENT_LIST.UPDATE_SELECT_BODY, 'ev_up_')
          return sendInteractiveList(phoneNumberId, from, payload)
        }
      }
      if (listReplyId.startsWith('ev_up_')) {
        const eventId = listReplyId.slice(6)
        const loaded = await getEventById(eventId, from)
        if (!loaded) {
          conversationState.set(from, { step: conversationState.STEPS.PUBLISHER_CHOOSE_ACTION })
          return sendInteractiveButtons(phoneNumberId, from, PUBLISHER.HOW_TO_CONTINUE)
        }
        const normalized = normalizeLoadedEventForEdit(loaded)
        conversationState.set(from, {
          step: conversationState.STEPS.EVENT_ADD_EDIT_MENU,
          eventAddDraftId: eventId,
          eventAddFormattedPreview: normalized,
          eventUpdateMode: true,
          eventUpdateList: undefined,
          eventUpdateListOffset: undefined,
        })
        return sendInteractiveList(phoneNumberId, from, buildEditMenuFirstMessagePayload())
      }
    }
    if (state.step === conversationState.STEPS.EVENT_DELETE_SELECT_EVENT) {
      if (listReplyId.startsWith('event_list_more_')) {
        const nextOffset = parseInt(listReplyId.slice('event_list_more_'.length), 10)
        if (!Number.isNaN(nextOffset)) {
          conversationState.set(from, { eventDeleteListOffset: nextOffset })
          const list = state.eventDeleteList || []
          const payload = buildPublisherEventListPayload(list, nextOffset, EVENT_LIST.DELETE_SELECT_BODY, 'ev_del_')
          return sendInteractiveList(phoneNumberId, from, payload)
        }
      }
      if (listReplyId.startsWith('ev_del_')) {
        const eventId = listReplyId.slice(7)
        conversationState.set(from, {
          step: conversationState.STEPS.EVENT_DELETE_CONFIRM,
          eventDeleteSelectedId: eventId,
          eventDeleteList: undefined,
          eventDeleteListOffset: undefined,
        })
        return sendText(phoneNumberId, from, EVENT_LIST.DELETE_CONFIRM_PROMPT)
      }
    }
  }

  if (msg.type === 'text' && msg.text?.body) {
    const textBody = String(msg.text.body).trim()
    const isWelcome = state.step === conversationState.STEPS.WELCOME
    const isPublisherChoice = state.step === conversationState.STEPS.PUBLISHER_CHOOSE_ACTION
    const isSuccessScreen = state.step === conversationState.STEPS.EVENT_ADD_SUCCESS
    if ((isWelcome || isPublisherChoice || isSuccessScreen) && config.allowMainMenuFreeLanguage && textBody) {
      try {
        const { intent } = await classifyMainMenuIntent(textBody, {
          openaiApiKey: config.openaiApiKey,
          openaiModel: config.openaiModel,
        })
        const isFirstMessageFlow = isWelcome && !state.welcomeShown
        if (intent === 'discover') {
          if (isPublisherChoice || isSuccessScreen) conversationState.clear(from)
          if (isFirstMessageFlow) await sendText(phoneNumberId, from, MAIN_MENU.FIRST_MESSAGE_FLOW_ACK)
          return handleDiscoverButton(phoneNumberId, from)
        }
        if (intent === 'contact') {
          if (isPublisherChoice || isSuccessScreen) conversationState.clear(from)
          if (isFirstMessageFlow) await sendText(phoneNumberId, from, MAIN_MENU.FIRST_MESSAGE_FLOW_ACK)
          return sendText(phoneNumberId, from, CONTACT.MESSAGE)
        }
        if (intent === 'publish') {
          if (isSuccessScreen) conversationState.clear(from)
          if (isFirstMessageFlow) await sendText(phoneNumberId, from, MAIN_MENU.FIRST_MESSAGE_FLOW_ACK)
          return handlePublishButton(phoneNumberId, from, profileName)
        }
        if (intent === 'event_add_new') {
          if (isSuccessScreen) conversationState.clear(from)
          if (isFirstMessageFlow) await sendText(phoneNumberId, from, MAIN_MENU.FIRST_MESSAGE_FLOW_ACK)
          if (isPublisherChoice) return sendEventAddMethodChoice(phoneNumberId, from)
          const { status } = await checkPublisher(from)
          if (status === 'approved') {
            conversationState.set(from, { step: conversationState.STEPS.PUBLISHER_CHOOSE_ACTION })
            return sendEventAddMethodChoice(phoneNumberId, from)
          }
          return handlePublishButton(phoneNumberId, from, profileName)
        }
        if (intent === 'event_update') {
          if (isSuccessScreen) conversationState.clear(from)
          if (isFirstMessageFlow) await sendText(phoneNumberId, from, MAIN_MENU.FIRST_MESSAGE_FLOW_ACK)
          if (isPublisherChoice) return handleEventUpdateChoice(phoneNumberId, from)
          const { status } = await checkPublisher(from)
          if (status === 'approved') return handleEventUpdateChoice(phoneNumberId, from)
          return handlePublishButton(phoneNumberId, from, profileName)
        }
        if (intent === 'event_delete') {
          if (isSuccessScreen) conversationState.clear(from)
          if (isFirstMessageFlow) await sendText(phoneNumberId, from, MAIN_MENU.FIRST_MESSAGE_FLOW_ACK)
          if (isPublisherChoice) return handleEventDeleteChoice(phoneNumberId, from)
          const { status } = await checkPublisher(from)
          if (status === 'approved') return handleEventDeleteChoice(phoneNumberId, from)
          return handlePublishButton(phoneNumberId, from, profileName)
        }
        if (intent === 'irrelevant') {
          if (isSuccessScreen) {
            return sendInteractiveButtons(phoneNumberId, from, {
              body: MAIN_MENU.INTENT_IRRELEVANT.body,
              buttons: [EVENT_ADD.SUCCESS_ADD_AGAIN_BUTTON, EVENT_ADD.SUCCESS_MAIN_MENU_BUTTON],
            })
          }
          if (isWelcome && !state.welcomeShown) {
            conversationState.set(from, { welcomeShown: true })
            return sendInteractiveButtons(phoneNumberId, from, WELCOME.INTERACTIVE)
          }
          return sendInteractiveButtons(phoneNumberId, from, MAIN_MENU.INTENT_IRRELEVANT)
        }
        if (intent === 'unclear') {
          if (isSuccessScreen) {
            return sendInteractiveButtons(phoneNumberId, from, {
              body: MAIN_MENU.INTENT_UNCLEAR.body,
              buttons: [EVENT_ADD.SUCCESS_ADD_AGAIN_BUTTON, EVENT_ADD.SUCCESS_MAIN_MENU_BUTTON],
            })
          }
          if (isWelcome && !state.welcomeShown) {
            conversationState.set(from, { welcomeShown: true })
            return sendInteractiveButtons(phoneNumberId, from, WELCOME.INTERACTIVE)
          }
          return sendInteractiveButtons(phoneNumberId, from, MAIN_MENU.INTENT_UNCLEAR)
        }
      } catch (err) {
        logger.error(LOG_PREFIXES.WEBHOOK, 'Main menu intent handling failed', err)
        if (isSuccessScreen) {
          return sendInteractiveButtons(phoneNumberId, from, {
            body: MAIN_MENU.INTENT_UNCLEAR.body,
            buttons: [EVENT_ADD.SUCCESS_ADD_AGAIN_BUTTON, EVENT_ADD.SUCCESS_MAIN_MENU_BUTTON],
          })
        }
        if (isWelcome && !state.welcomeShown) {
          conversationState.set(from, { welcomeShown: true })
          return sendInteractiveButtons(phoneNumberId, from, WELCOME.INTERACTIVE)
        }
        return sendInteractiveButtons(phoneNumberId, from, MAIN_MENU.INTENT_UNCLEAR)
      }
    }
    if (state.step === conversationState.STEPS.EVENT_DELETE_CONFIRM) {
      if (textBody === EVENT_LIST.DELETE_CONFIRM_KEYWORD) {
        const eventId = state.eventDeleteSelectedId
        const result = await deleteEvent(eventId)
        conversationState.clear(from)
        return sendInteractiveButtons(phoneNumberId, from, {
          body: EVENT_LIST.DELETE_SUCCESS,
          buttons: EVENT_LIST.DELETE_SUCCESS_BUTTONS,
        })
      }
      return sendText(phoneNumberId, from, EVENT_LIST.DELETE_CONFIRM_PROMPT)
    }
    if (state.step === conversationState.STEPS.PUBLISH_ASK_FULL_NAME) {
      conversationState.set(from, { fullName: textBody, step: conversationState.STEPS.PUBLISH_ASK_PUBLISHING_AS })
      return sendText(phoneNumberId, from, PUBLISH.ASK_PUBLISHING_AS)
    }
    if (state.step === conversationState.STEPS.PUBLISH_ASK_PUBLISHING_AS) {
      conversationState.set(from, { publishingAs: textBody, step: conversationState.STEPS.PUBLISH_ASK_EVENT_TYPES })
      return sendText(phoneNumberId, from, PUBLISH.ASK_EVENT_TYPES)
    }
    if (state.step === conversationState.STEPS.PUBLISH_ASK_EVENT_TYPES) {
      conversationState.set(from, {
        eventTypesDescription: textBody,
        step: conversationState.STEPS.PUBLISH_ASK_COMMITMENT,
      })
      return sendInteractiveButtons(phoneNumberId, from, PUBLISH.ASK_COMMITMENT)
    }
    if (state.step === conversationState.STEPS.PUBLISH_ASK_COMMITMENT) {
      return sendInteractiveButtons(phoneNumberId, from, PUBLISH.ASK_COMMITMENT)
    }
  }

  const publishSteps = [
    conversationState.STEPS.PUBLISH_ASK_FULL_NAME,
    conversationState.STEPS.PUBLISH_ASK_PUBLISHING_AS,
    conversationState.STEPS.PUBLISH_ASK_EVENT_TYPES,
    conversationState.STEPS.PUBLISH_ASK_COMMITMENT,
  ]
  if (publishSteps.includes(state.step) && msg.type !== 'text') {
    return sendText(phoneNumberId, from, PUBLISH.EXPECT_TEXT)
  }

  conversationState.set(from, { step: conversationState.STEPS.WELCOME, welcomeShown: true })
  return sendInteractiveButtons(phoneNumberId, from, WELCOME.MAIN_MENU_RETURN)
}

/** Per-user message queue: process one message at a time per user so state updates correctly (e.g. bulk media). */
const userMessageQueues = new Map()

function flushPending(entry) {
  if (entry.flushTimerId != null) {
    clearTimeout(entry.flushTimerId)
    entry.flushTimerId = null
  }
  if (entry.pending.length === 0) return
  const count = entry.pending.length
  entry.queue.push(...entry.pending)
  entry.pending = []
  if (!entry.processing) {
    entry.processing = true
    setImmediate(() => processQueueLoop(entry))
  }
}

async function processQueueLoop(entry) {
  let lastItem = null
  while (entry.queue.length > 0) {
    const item = entry.queue.shift()
    item.context.hasMoreInQueue = entry.queue.length > 0
    try {
      const result = await processOneMessage(
        item.phoneNumberId,
        item.from,
        item.msg,
        item.context,
      )
      if (result && !result.success) logger.error(LOG_PREFIXES.WEBHOOK, 'Send result', result.error)
    } catch (err) {
      logger.error(LOG_PREFIXES.WEBHOOK, 'Failed to send reply', err)
    }
    lastItem = item
  }
  entry.processing = false
  if (entry.queue.length > 0) {
    entry.processing = true
    processQueueLoop(entry)
  } else if (lastItem) {
    const isMedia = lastItem.msg?.type === 'image' || lastItem.msg?.type === 'video'
    if (isMedia) {
      Promise.resolve(sendMediaMoreMessageIfNeeded(lastItem.phoneNumberId, lastItem.from))
        .catch((err) => logger.error(LOG_PREFIXES.WEBHOOK, 'sendMediaMoreMessageIfNeeded failed', err))
    }
  }
}

function enqueueAndProcessUser(phoneNumberId, from, msg, context) {
  const key = normalizePhone(from)
  let entry = userMessageQueues.get(key)
  if (!entry) {
    entry = { queue: [], processing: false, userKey: key, pending: [], flushTimerId: null }
    userMessageQueues.set(key, entry)
  } else {
    entry.userKey = key
  }
  entry.pending.push({ phoneNumberId, from, msg, context })
  if (entry.flushTimerId != null) clearTimeout(entry.flushTimerId)
  entry.flushTimerId = setTimeout(() => flushPending(entry), BATCH_FLUSH_MS)
}

/**
 * Parse webhook body and process incoming messages. Route by interactive type and conversation state.
 * Also handles status updates: when approver request message fails with 131047 (re-engagement), send template and queue approval UI for when approver replies.
 * Messages for the same user are processed sequentially so bulk uploads update state correctly.
 */
function processWebhookBody(body) {
  if (body.object !== 'whatsapp_business_account') return
  const entries = body.entry || []
  for (const entry of entries) {
    const changes = entry.changes || []
    for (const change of changes) {
      if (change.field !== 'messages') continue
      const value = change.value || {}
      const metadata = value.metadata || {}
      const phoneNumberId = metadata.phone_number_id

      const statuses = value.statuses || []
      for (const st of statuses) {
        const messageId = st.id
        if (st.status === 'sent' || st.status === 'delivered') {
          if (messageIdToApproverWaId.has(messageId)) {
            messageIdToApproverWaId.delete(messageId)
            lastApproverRequestPayloadByMessageId.delete(messageId)
          }
        }
        if (st.status === 'failed' && Array.isArray(st.errors) && st.errors.length > 0) {
          const err = st.errors[0]
          if (err.code === REENGAGEMENT_ERROR_CODE) {
            const payload = lastApproverRequestPayloadByMessageId.get(messageId)
            if (payload && phoneNumberId) {
              lastApproverRequestPayloadByMessageId.delete(messageId)
              messageIdToApproverWaId.delete(messageId)
              let list = pendingApproverRequestByApprover.get(payload.approverWaId)
              if (!list) {
                list = []
                pendingApproverRequestByApprover.set(payload.approverWaId, list)
              }
              list.push({
                publisherWaId: payload.publisherWaId,
                fullName: payload.fullName,
                body: payload.body,
                buttons: payload.buttons,
              })
              const isFirst = list.length === 1
              if (config.approverReengagementTemplateName && isFirst) {
                sendTemplate(
                  phoneNumberId,
                  payload.approverWaId,
                  config.approverReengagementTemplateName,
                  config.approverReengagementTemplateLanguage,
                  { includeQuickReplyButton: true },
                ).then((r) => {
                  if (!r.success) logger.error(LOG_PREFIXES.WEBHOOK, 'Approver re-engagement template failed', r.error)
                })
              }
            }
            if (payload && !config.approverReengagementTemplateName) {
              logger.warn(LOG_PREFIXES.WEBHOOK, 'Approver request failed with 131047 but APPROVER_REENGAGEMENT_TEMPLATE_NAME not set')
            }
          }
        }
      }

      const messages = value.messages || []
      if (messages.length === 0) continue
      const profileName = value.contacts?.[0]?.profile?.name
      for (const msg of messages) {
        if (!isPrivateMessage(msg)) {
          logger.info(LOG_PREFIXES.WEBHOOK, 'Skip non-private message', msg.id)
          continue
        }
        const from = msg.from
        if (!phoneNumberId || !from || typeof phoneNumberId !== 'string' || typeof from !== 'string') {
          logger.warn(LOG_PREFIXES.WEBHOOK, 'Skip message: missing phoneNumberId or from', msg?.id)
          continue
        }
        if (msg.type === 'unsupported') {
          logger.debug(LOG_PREFIXES.WEBHOOK, 'Skip unsupported message', msg.id)
          continue
        }
        logger.info(LOG_PREFIXES.WEBHOOK, 'Private message from', from)
        enqueueAndProcessUser(phoneNumberId, from, msg, { profileName })
      }
    }
  }
}

/**
 * GET: Webhook verification. Meta sends hub.mode=subscribe, hub.verify_token, hub.challenge.
 */
export function handleGet(req, res) {
  const mode = req.url && new URL(req.url, `http://${req.headers.host}`).searchParams.get('hub.mode')
  const token = req.url && new URL(req.url, `http://${req.headers.host}`).searchParams.get('hub.verify_token')
  const challenge = req.url && new URL(req.url, `http://${req.headers.host}`).searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token === config.webhook.verifyToken && challenge) {
    logger.info(LOG_PREFIXES.WEBHOOK, 'Webhook verified')
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(challenge)
    return
  }
  logger.warn(LOG_PREFIXES.WEBHOOK, 'Webhook verification failed')
  res.writeHead(403, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Verification failed' }))
}

/**
 * POST: Incoming webhook payload. Respond 200 quickly; process or forward async.
 * When dev forward is enabled and payload is for test number, forward to ngrok and do not process.
 */
export function handlePost(req, res) {
  let raw = ''
  req.on('data', (chunk) => { raw += chunk })
  req.on('end', () => {
    const signatureHeader = req.headers['x-hub-signature-256']
    const appSecret = config.webhook?.appSecret

    if (appSecret) {
      if (!verifyWebhookSignature(raw, signatureHeader, appSecret)) {
        logger.warn(LOG_PREFIXES.WEBHOOK, 'Webhook signature verification failed')
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid signature' }))
        return
      }
    } else {
      if (!hasWarnedNoAppSecret) {
        hasWarnedNoAppSecret = true
        logger.warn(LOG_PREFIXES.WEBHOOK, 'Webhook signature verification skipped: APP_SECRET not set')
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    try {
      const body = JSON.parse(raw || '{}')
      const phoneNumberId = getPhoneNumberId(body)
      const forwardedHeader = req.headers['x-dev-forwarded']

      if (shouldForwardToDev(config, phoneNumberId, forwardedHeader)) {
        forwardToDev(raw, config, logger, LOG_PREFIXES.WEBHOOK)
        if (!config.isProduction) logger.info(LOG_PREFIXES.WEBHOOK, '[DEV FORWARD] test payload -> ngrok')
        return
      }

      if (forwardedHeader === '1') {
        const value = body.entry?.[0]?.changes?.[0]?.value
        const messages = value?.messages ?? []
        if (!config.isProduction && messages.length > 0) {
          const firstMsg = messages[0]
          const summary = firstMsg
            ? `from=${firstMsg.from} type=${firstMsg.type || 'unknown'}`
            : ''
          logger.info(
            LOG_PREFIXES.WEBHOOK,
            `[DEV WEBHOOK RECEIVED] phone_number_id=${phoneNumberId || 'n/a'} messages=${messages.length} ${summary}`.trim(),
          )
        }
      } else {
        logger.debug(LOG_PREFIXES.WEBHOOK, 'POST body received', JSON.stringify(body).slice(0, 500))
      }
      processWebhookBody(body)
    } catch (err) {
      logger.error(LOG_PREFIXES.WEBHOOK, 'Webhook parse error', err)
    }
  })
}

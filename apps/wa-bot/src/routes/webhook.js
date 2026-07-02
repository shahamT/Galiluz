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
  APPROVER,
  PUBLISHER,
  MAIN_MENU,
  BATCH_FLUSH_MS,
} from '../consts/index.js'
import { deleteEvent } from '../services/eventsCreate.service.js'
import { approvePublisher, rejectPublisher } from '../services/publishers.service.js'
import { isApprover, getApproverName, getAllApprovers } from '../services/approvers.service.js'
import { CATEGORY_GROUPS, CATEGORY_ALL_ID } from '../consts/categories.const.js'
import {
  getPhoneNumberId,
  shouldForwardToDev,
  forwardToDev,
} from '../utils/whatsappWebhookRouter.js'
import { verifyWebhookSignature } from '../utils/webhookSignature.js'
import { approverEventNotifications } from '../utils/approverEventNotifications.js'
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
  return fullName || APPROVER.DEFAULT_PUBLISHER_LABEL
}

function storePublisherNameForApprover(approverWaId, publisherWaId, fullName) {
  let byWaId = pendingPublisherNamesByApprover.get(approverWaId)
  if (!byWaId) {
    byWaId = new Map()
    pendingPublisherNamesByApprover.set(approverWaId, byWaId)
  }
  byWaId.set(publisherWaId, fullName || APPROVER.DEFAULT_PUBLISHER_LABEL)
}

/** Push a proactive notice to every approver except the one who acted. Best-effort. */
async function notifyOtherApprovers(phoneNumberId, actorWaId, message) {
  const actorNorm = normalizePhone(actorWaId)
  for (const a of getAllApprovers()) {
    if (a.waId === actorNorm) continue
    await sendText(phoneNumberId, a.waId, message).catch(() => {})
  }
}

const APPROVER_ACTION_ERROR = 'אירעה שגיאה בביצוע הפעולה, נסו שוב מאוחר יותר.'

/**
 * Reject a publisher and handle the first-wins outcome: winner confirms + proactively notifies the
 * other approvers; a late approver is told it was already handled. The publisher's rejection notice
 * (with the reason) is sent by the WEB on the winner path, via the wa-gateway — the Cloud API can't
 * reach cold users without (unavailable) templates.
 */
async function finishReject(phoneNumberId, from, waId, reason, localName) {
  const result = await rejectPublisher(waId, from, reason)
  conversationState.clear(from)
  const pubName = result.publisherName || localName || APPROVER.DEFAULT_PUBLISHER_LABEL
  if (result.applied) {
    await sendText(phoneNumberId, from, APPROVER.CONFIRM_REJECTED.replace('{fullName}', pubName))
    await notifyOtherApprovers(phoneNumberId, from, APPROVER.OTHER_REJECTED.replace('{actor}', getApproverName(from) || 'מאשר').replace('{fullName}', pubName))
  } else if (result.error) {
    await sendText(phoneNumberId, from, APPROVER_ACTION_ERROR)
  } else {
    const by = result.by || 'מאשר אחר'
    const tmpl = result.resolvedStatus === 'approved' ? APPROVER.ALREADY_APPROVED_BY : APPROVER.ALREADY_REJECTED_BY
    await sendText(phoneNumberId, from, tmpl.replace('{fullName}', pubName).replace('{by}', by))
  }
}

/**
 * Delete an event and handle the first-wins outcome: winner confirms + proactively notifies the
 * other approvers; a late approver is told it was already deleted. The publisher's deleted-notice
 * (when a reason was given) is sent by the WEB on the winner path, via the wa-gateway — the reason
 * travels in the delete request body.
 */
async function finishDelete(phoneNumberId, from, eventId, reason, info) {
  const result = await deleteEvent(eventId, from, reason)
  approverEventNotifications.remove(eventId)
  conversationState.clear(from)
  const title = result.eventTitle || info?.eventTitle || 'אירוע'
  if (result.applied) {
    await sendText(phoneNumberId, from, APPROVER.DELETE_EVENT_SUCCESS)
    await notifyOtherApprovers(phoneNumberId, from, APPROVER.OTHER_DELETED.replace('{actor}', getApproverName(from) || 'מאשר').replace('{title}', title))
  } else if (result.error) {
    await sendText(phoneNumberId, from, APPROVER_ACTION_ERROR)
  } else {
    await sendText(phoneNumberId, from, APPROVER.ALREADY_DELETED_BY.replace('{by}', result.by || 'מאשר אחר'))
  }
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

function sendDiscoverRegionStep(phoneNumberId, from) {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  const imageUrl = baseUrl.startsWith('http://localhost')
    ? 'https://galiluz.co.il/imgs/areas-filter-map.png'
    : `${baseUrl}/imgs/areas-filter-map.png`
  conversationState.set(from, { step: conversationState.STEPS.DISCOVER_REGION })
  return sendInteractiveButtons(phoneNumberId, from, {
    header: { type: 'image', imageUrl },
    body: DISCOVER.ASK_REGION,
    buttons: [...DISCOVER.REGION_BUTTONS],
  })
}

function handleDiscoverListReply(phoneNumberId, from, listReplyId) {
  conversationState.set(from, { categoryGroupId: listReplyId })
  return sendDiscoverRegionStep(phoneNumberId, from)
}

function handleDiscoverTimeChoice(phoneNumberId, from, timeChoice) {
  const state = conversationState.get(from)
  const categoryGroupId = state.categoryGroupId || CATEGORY_ALL_ID
  const discoverRegion = state.discoverRegion || null
  const prevSearched = state.discoverSearchedTimesByCategory?.[categoryGroupId] || []
  const searchedTimesForCategory = [...new Set([...prevSearched, timeChoice])]
  const dateString = getDateIsrael(timeChoice)
  return getEventsMessageForDateAndCategory(dateString, categoryGroupId, timeChoice, discoverRegion)
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

function handleBackToMenu(phoneNumberId, from) {
  conversationState.clear(from)
  conversationState.set(from, { step: conversationState.STEPS.WELCOME, welcomeShown: true })
  return sendInteractiveButtons(phoneNumberId, from, WELCOME.MAIN_MENU_RETURN)
}

// The publisher lifecycle (registration + add/update/delete event) lives entirely on the web
// portal. Every publisher entry point funnels here and replies with a single redirect (login +
// register links). Clears state so the next message starts clean. URLs come from galiluzAppUrl
// (localhost in dev, galiluz.co.il in prod); reply buttons can't carry URLs, so this is sent as
// text and WhatsApp auto-links them.
function sendPublisherPortalRedirect(phoneNumberId, from) {
  conversationState.clear(from)
  const base = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  const body = PUBLISHER.PORTAL_REDIRECT.body
    .replace('{loginUrl}', `${base}/login`)
    .replace('{registerUrl}', `${base}/register`)
  return sendText(phoneNumberId, from, body)
}

// Exact-text trigger sent by the website's "register as a publisher" deep link. Matches a
// distinctive core phrase (whitespace-normalized) so it's robust to surrounding wording.
const PUBLISHER_REGISTER_TRIGGER_CORE = 'רוצה להירשם כמפרסם'
function isPublisherRegisterTrigger(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().includes(PUBLISHER_REGISTER_TRIGGER_CORE)
}

/**
 * Send the approver the Approve/Reject buttons for a publisher registration. Called by the
 * website registration flow via the /internal/notify-approver endpoint. The buttons call the
 * approve/reject API endpoints.
 */
export async function notifyApproverOfRegistration({ phoneNumberId, waId, fullName = '', accountName = '', eventTypesDescription = '', email = '' }) {
  const approvers = getAllApprovers()
  if (!approvers.length) {
    logger.warn(LOG_PREFIXES.WEBHOOK, 'No approvers configured — registration not surfaced to an approver')
    return { success: false, error: 'no_approver' }
  }
  let body = APPROVER.REQUEST_BODY_TEMPLATE
    .replace('{fullName}', fullName)
    .replace('{publishingAs}', accountName)
    .replace('{eventTypes}', eventTypesDescription)
    .replace('{waId}', waId)
  if (email) body += `\n*אימייל:* ${email}`
  const buttons = [
    { id: APPROVER.BUTTONS.approve.idPrefix + waId, title: APPROVER.BUTTONS.approve.title },
    { id: APPROVER.BUTTONS.reject.idPrefix + waId, title: APPROVER.BUTTONS.reject.title },
    { id: APPROVER.BUTTONS.rejectNoReason.idPrefix + waId, title: APPROVER.BUTTONS.rejectNoReason.title },
  ]
  // Fan out to every approver. Per-approver tracking maps (names + 131047 re-engagement) are keyed
  // by approverWaId, so each gets its own confirmation/queue.
  let anySuccess = false
  for (const approver of approvers) {
    storePublisherNameForApprover(approver.waId, waId, fullName)
    const sendResult = await sendInteractiveButtons(phoneNumberId, approver.waId, { body, buttons })
    if (sendResult.success && sendResult.messageId) {
      messageIdToApproverWaId.set(sendResult.messageId, approver.waId)
      lastApproverRequestPayloadByMessageId.set(sendResult.messageId, { approverWaId: approver.waId, body, buttons, publisherWaId: waId, fullName })
      anySuccess = true
    } else if (!sendResult.success) {
      logger.error(LOG_PREFIXES.WEBHOOK, 'Notify approver failed', approver.waId, sendResult.error)
    }
  }
  return { success: anySuccess }
}

/**
 * POST /internal/notify-approver (API_SECRET via x-api-secret) — the website registration flow
 * calls this after phone verification so the approver receives the Approve/Reject buttons. Uses
 * the configured Cloud API phone number id (no incoming-webhook context).
 */
export function handleNotifyApprover(req, res) {
  const secret = req.headers['x-api-secret'] || req.headers['x-api-key'] || ''
  if (!config.galiluzAppApiKey || secret !== config.galiluzAppApiKey) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'unauthorized' }))
    return
  }
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', async () => {
    try {
      const data = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}
      const waId = normalizePhone(data.waId || '')
      if (!waId) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'waId required' }))
        return
      }
      await notifyApproverOfRegistration({
        phoneNumberId: config.whatsapp.phoneNumberId,
        waId,
        fullName: data.fullName,
        accountName: data.accountName,
        eventTypesDescription: data.eventTypesDescription,
        email: data.email,
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
    } catch (err) {
      logger.error(LOG_PREFIXES.WEBHOOK, 'notify-approver failed', err instanceof Error ? err.message : String(err))
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'internal' }))
    }
  })
}

/**
 * POST /internal/notify-approver-event (API_SECRET via x-api-secret) — the WEB app calls this
 * when an event becomes active (draft → published) so the approver gets a "new event added"
 * notification + delete button. The web builds the body (it owns the event shape); the bot relays
 * it with the delete button and stores the publisher phone + title for the delete flow.
 */
export function handleNotifyApproverEvent(req, res) {
  const secret = req.headers['x-api-secret'] || req.headers['x-api-key'] || ''
  if (!config.galiluzAppApiKey || secret !== config.galiluzAppApiKey) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'unauthorized' }))
    return
  }
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', async () => {
    try {
      const data = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}
      const eventId = typeof data.eventId === 'string' ? data.eventId : ''
      const body = typeof data.body === 'string' ? data.body : ''
      if (!eventId || !body) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'eventId and body required' }))
        return
      }
      const approvers = getAllApprovers()
      if (!approvers.length) {
        logger.warn(LOG_PREFIXES.WEBHOOK, 'No approvers configured — web event not surfaced to an approver')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'no_approver' }))
        return
      }
      approverEventNotifications.store(eventId, {
        publisherPhone: typeof data.publisherPhone === 'string' ? data.publisherPhone : '',
        eventTitle: typeof data.eventTitle === 'string' ? data.eventTitle : '',
      })
      const buttons = [{ id: `approver_delete_event_${eventId}`, title: APPROVER.DELETE_EVENT_BUTTON.title }]
      // Fan out to every approver; each gets its own delete button + 131047 re-engagement tracking.
      let anySuccess = false
      for (const approver of approvers) {
        const sendResult = await sendInteractiveButtons(config.whatsapp.phoneNumberId, approver.waId, { body, buttons })
        if (sendResult.success && sendResult.messageId) {
          messageIdToApproverWaId.set(sendResult.messageId, approver.waId)
          lastApproverRequestPayloadByMessageId.set(sendResult.messageId, {
            approverWaId: approver.waId,
            body,
            buttons,
            templateName: config.approverEventReengagementTemplateName,
            templateLanguage: config.approverEventReengagementTemplateLanguage,
          })
          anySuccess = true
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: anySuccess }))
    } catch (err) {
      logger.error(LOG_PREFIXES.WEBHOOK, 'notify-approver-event failed', err instanceof Error ? err.message : String(err))
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'internal' }))
    }
  })
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
      const localName = getAndRemovePublisherName(from, waId)
      const result = await approvePublisher(waId, from)
      conversationState.clear(from)
      const pubName = result.publisherName || localName
      if (result.applied) {
        // Winner: confirm + tell the other approvers. The publisher's "you're approved" notice
        // (with the login link) is sent by the WEB via the wa-gateway — the Cloud API can't reach
        // cold users without (unavailable) templates.
        await sendText(phoneNumberId, from, APPROVER.CONFIRM_APPROVED.replace('{fullName}', pubName))
        await notifyOtherApprovers(phoneNumberId, from, APPROVER.OTHER_APPROVED.replace('{actor}', getApproverName(from) || 'מאשר').replace('{fullName}', pubName))
      } else if (result.error) {
        await sendText(phoneNumberId, from, APPROVER_ACTION_ERROR)
      } else {
        const by = result.by || 'מאשר אחר'
        const tmpl = result.resolvedStatus === 'rejected' ? APPROVER.ALREADY_REJECTED_BY : APPROVER.ALREADY_APPROVED_BY
        await sendText(phoneNumberId, from, tmpl.replace('{fullName}', pubName).replace('{by}', by))
      }
      return
    }
    if (id.startsWith('reject_no_reason_')) {
      const waId = id.slice(17)
      const localName = getAndRemovePublisherName(from, waId)
      await finishReject(phoneNumberId, from, waId, '', localName)
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
      const localName = getAndRemovePublisherName(from, waId)
      await finishReject(phoneNumberId, from, waId, '', localName)
      return
    }
    if (id.startsWith('approver_delete_event_')) {
      const eventId = id.slice('approver_delete_event_'.length)
      const info = approverEventNotifications.get(eventId)
      conversationState.set(from, {
        step: conversationState.STEPS.APPROVER_WAITING_DELETE_REASON,
        approverDeleteEventId: eventId,
        approverDeletePublisherPhone: info?.publisherPhone || null,
        approverDeleteEventTitle: info?.eventTitle || '',
      })
      return sendInteractiveButtons(phoneNumberId, from, APPROVER.DELETE_EVENT_ASK)
    }
    if (id === 'approver_delete_no_reason') {
      const eventId = state.approverDeleteEventId
      if (eventId) {
        await finishDelete(phoneNumberId, from, eventId, '', {
          publisherPhone: state.approverDeletePublisherPhone,
          eventTitle: state.approverDeleteEventTitle,
        })
      } else {
        conversationState.clear(from)
      }
      return
    }
    if (id === 'approver_delete_cancel') {
      conversationState.clear(from)
      return sendText(phoneNumberId, from, APPROVER.DELETE_EVENT_CANCELLED)
    }
  }

  if (msg.type === 'text' && msg.text?.body && state.step === conversationState.STEPS.APPROVER_WAITING_REASON) {
    const waId = state.publisherWaId
    const reason = String(msg.text.body).trim()
    if (waId) {
      const localName = getAndRemovePublisherName(from, waId)
      await finishReject(phoneNumberId, from, waId, reason, localName)
      return
    }
  }

  if (msg.type === 'text' && msg.text?.body && state.step === conversationState.STEPS.APPROVER_WAITING_DELETE_REASON) {
    const eventId = state.approverDeleteEventId
    const reason = String(msg.text.body).trim()
    if (eventId) {
      await finishDelete(phoneNumberId, from, eventId, reason, {
        publisherPhone: state.approverDeletePublisherPhone,
        eventTitle: state.approverDeleteEventTitle,
      })
    } else {
      conversationState.clear(from)
    }
    return
  }

  conversationState.set(from, { step: conversationState.STEPS.WELCOME, welcomeShown: true })
  return sendInteractiveButtons(phoneNumberId, from, WELCOME.MAIN_MENU_RETURN)
}

async function processOneMessage(phoneNumberId, from, msg) {
  if (isApprover(from)) {
    return handleApproverFlow(phoneNumberId, from, msg)
  }

  const interactive = msg.interactive
  const state = conversationState.get(from)

  if (interactive?.type === 'button_reply') {
    const id = interactive.button_reply?.id
    if (id === 'discover') {
      return handleDiscoverButton(phoneNumberId, from)
    }
    if (
      (id === 'center' || id === 'golan' || id === 'upper') &&
      state.step === conversationState.STEPS.DISCOVER_REGION
    ) {
      conversationState.set(from, { discoverRegion: id, step: conversationState.STEPS.DISCOVER_TIME })
      return sendInteractiveButtons(phoneNumberId, from, DISCOVER.ASK_TIME)
    }
    if (id === 'publish') {
      // The publisher lifecycle lives on the web portal.
      return sendPublisherPortalRedirect(phoneNumberId, from)
    }
    if (id === 'contact') {
      return sendText(phoneNumberId, from, CONTACT.MESSAGE)
    }
    if (id === 'back_to_menu' || id === 'back_to_main') {
      return handleBackToMenu(phoneNumberId, from)
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

  if (msg.type === 'text' && msg.text?.body) {
    const textBody = String(msg.text.body).trim()
    // Website "register as a publisher" deep link → portal redirect (the message itself links to /register).
    if (textBody && isPublisherRegisterTrigger(textBody)) {
      return sendPublisherPortalRedirect(phoneNumberId, from)
    }
    const isWelcome = state.step === conversationState.STEPS.WELCOME
    if (isWelcome && config.allowMainMenuFreeLanguage && textBody) {
      try {
        const { intent } = await classifyMainMenuIntent(textBody, {
          openaiApiKey: config.openaiApiKey,
          openaiModel: config.openaiModel,
        })
        const isFirstMessageFlow = !state.welcomeShown
        if (intent === 'discover') {
          if (isFirstMessageFlow) await sendText(phoneNumberId, from, MAIN_MENU.FIRST_MESSAGE_FLOW_ACK)
          return handleDiscoverButton(phoneNumberId, from)
        }
        if (intent === 'contact') {
          if (isFirstMessageFlow) await sendText(phoneNumberId, from, MAIN_MENU.FIRST_MESSAGE_FLOW_ACK)
          return sendText(phoneNumberId, from, CONTACT.MESSAGE)
        }
        if (intent === 'publish') {
          // sendPublisherPortalRedirect clears state, so no separate clear is needed here.
          return sendPublisherPortalRedirect(phoneNumberId, from)
        }
        // irrelevant | unclear
        if (!state.welcomeShown) {
          conversationState.set(from, { welcomeShown: true })
          return sendInteractiveButtons(phoneNumberId, from, WELCOME.INTERACTIVE)
        }
        return sendInteractiveButtons(
          phoneNumberId,
          from,
          intent === 'irrelevant' ? MAIN_MENU.INTENT_IRRELEVANT : MAIN_MENU.INTENT_UNCLEAR,
        )
      } catch (err) {
        logger.error(LOG_PREFIXES.WEBHOOK, 'Main menu intent handling failed', err)
        if (!state.welcomeShown) {
          conversationState.set(from, { welcomeShown: true })
          return sendInteractiveButtons(phoneNumberId, from, WELCOME.INTERACTIVE)
        }
        return sendInteractiveButtons(phoneNumberId, from, MAIN_MENU.INTENT_UNCLEAR)
      }
    }
  }

  conversationState.set(from, { step: conversationState.STEPS.WELCOME, welcomeShown: true })
  return sendInteractiveButtons(phoneNumberId, from, WELCOME.MAIN_MENU_RETURN)
}

/** Per-user message queue: process one message at a time per user so state updates correctly. */
const userMessageQueues = new Map()

function flushPending(entry) {
  if (entry.flushTimerId != null) {
    clearTimeout(entry.flushTimerId)
    entry.flushTimerId = null
  }
  if (entry.pending.length === 0) return
  entry.queue.push(...entry.pending)
  entry.pending = []
  if (!entry.processing) {
    entry.processing = true
    setImmediate(() => processQueueLoop(entry))
  }
}

async function processQueueLoop(entry) {
  while (entry.queue.length > 0) {
    const item = entry.queue.shift()
    try {
      const result = await processOneMessage(item.phoneNumberId, item.from, item.msg)
      if (result && !result.success) logger.error(LOG_PREFIXES.WEBHOOK, 'Send result', result.error)
    } catch (err) {
      logger.error(LOG_PREFIXES.WEBHOOK, 'Failed to send reply', err)
    }
  }
  entry.processing = false
  if (entry.queue.length > 0) {
    entry.processing = true
    processQueueLoop(entry)
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
 * Also handles status updates: when an approver request message fails with 131047 (re-engagement),
 * send a template and queue the approval UI for when the approver replies.
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
              // Template per item type: event notifications carry their own template name/language
              // (set when queued); registration requests leave them unset → shared approver template.
              const tplName = payload.templateName || config.approverReengagementTemplateName
              const tplLang = payload.templateLanguage || config.approverReengagementTemplateLanguage
              const isFirst = list.length === 1
              if (tplName && isFirst) {
                sendTemplate(
                  phoneNumberId,
                  payload.approverWaId,
                  tplName,
                  tplLang,
                  { includeQuickReplyButton: true },
                ).then((r) => {
                  if (!r.success) logger.error(LOG_PREFIXES.WEBHOOK, 'Approver re-engagement template failed', r.error)
                })
              }
              if (!tplName) {
                logger.warn(LOG_PREFIXES.WEBHOOK, 'Approver request failed with 131047 but no re-engagement template set')
              }
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

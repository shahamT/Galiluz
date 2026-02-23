import { config } from '../config.js'
import {
  sendText,
  sendInteractiveButtons,
  sendInteractiveList,
} from '../services/cloudApi.service.js'
import { conversationState } from '../services/conversationState.service.js'
import { getEventsMessageForDateAndCategory, getDateIsrael } from '../services/eventsDiscovery.service.js'
import { logger } from '../utils/logger.js'
import {
  LOG_PREFIXES,
  WELCOME_INTERACTIVE,
  DISCOVER_ASK_CATEGORY,
  DISCOVER_ASK_TIME,
  DISCOVER_AFTER_LIST,
  PUBLISH_REPLY,
  PUBLISH_NOT_REGISTERED,
  PUBLISH_ASK_FULL_NAME,
  PUBLISH_ASK_PUBLISHING_AS,
  PUBLISH_ASK_EVENT_TYPES,
  PUBLISH_ASK_COMMITMENT,
  PUBLISH_THANK_YOU,
  PUBLISH_PENDING_MESSAGE,
} from '../consts/index.js'
import { checkPublisher, registerPublisher } from '../services/publishers.service.js'
import { CATEGORY_GROUPS, CATEGORY_ALL_ID } from '../consts/categories.const.js'

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

/** Category list for discover flow: 4 groups + הכל */
const DISCOVER_CATEGORY_LIST = {
  body: DISCOVER_ASK_CATEGORY,
  button: 'בחר',
  sections: [
    {
      title: 'אפשרויות',
      rows: [
        ...CATEGORY_GROUPS.map((g) => ({ id: g.id, title: g.label })),
        { id: CATEGORY_ALL_ID, title: 'הכל' },
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
  return sendInteractiveButtons(phoneNumberId, from, DISCOVER_ASK_TIME)
}

function handleDiscoverTimeButton(phoneNumberId, from, timeChoice) {
  const state = conversationState.get(from)
  const categoryGroupId = state.categoryGroupId || CATEGORY_ALL_ID
  conversationState.clear(from)
  const dateString = getDateIsrael(timeChoice)
  return getEventsMessageForDateAndCategory(dateString, categoryGroupId, timeChoice)
    .then((messageBody) => sendText(phoneNumberId, from, messageBody))
    .then((result) => {
      if (result?.success) return sendInteractiveButtons(phoneNumberId, from, DISCOVER_AFTER_LIST)
      return result
    })
}

async function handlePublishButton(phoneNumberId, from, profileName) {
  const { status } = await checkPublisher(from)
  if (status === 'approved') {
    return sendText(phoneNumberId, from, PUBLISH_REPLY)
  }
  if (status === 'pending') {
    return sendText(phoneNumberId, from, PUBLISH_PENDING_MESSAGE)
  }
  return sendInteractiveButtons(phoneNumberId, from, PUBLISH_NOT_REGISTERED)
}

function handleBackToMenu(phoneNumberId, from) {
  conversationState.clear(from)
  return sendInteractiveButtons(phoneNumberId, from, WELCOME_INTERACTIVE)
}

function handlePublishSignMeUp(phoneNumberId, from, profileName) {
  conversationState.set(from, {
    step: conversationState.STEPS.PUBLISH_ASK_FULL_NAME,
    ...(profileName && { profileName }),
  })
  return sendText(phoneNumberId, from, PUBLISH_ASK_FULL_NAME)
}

function handlePublishCommitNo(phoneNumberId, from) {
  conversationState.clear(from)
  return sendInteractiveButtons(phoneNumberId, from, PUBLISH_NOT_REGISTERED)
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
    return sendText(phoneNumberId, from, 'משהו השתבש. נסה שוב מאוחר יותר.')
  }
  return sendInteractiveButtons(phoneNumberId, from, PUBLISH_THANK_YOU)
}

function processOneMessage(phoneNumberId, from, msg, context = {}) {
  const interactive = msg.interactive
  const state = conversationState.get(from)
  const profileName = context.profileName

  if (interactive?.type === 'button_reply') {
    const id = interactive.button_reply?.id
    if (id === 'discover') {
      return handleDiscoverButton(phoneNumberId, from)
    }
    if (id === 'publish') {
      return handlePublishButton(phoneNumberId, from, profileName)
    }
    if (id === 'back_to_menu' || id === 'back_to_main') {
      return handleBackToMenu(phoneNumberId, from)
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
    if ((id === 'today' || id === 'tomorrow') && state.step === conversationState.STEPS.DISCOVER_TIME) {
      return handleDiscoverTimeButton(phoneNumberId, from, id)
    }
  }

  if (interactive?.type === 'list_reply' && state.step === conversationState.STEPS.DISCOVER_CATEGORY) {
    const listReplyId = interactive.list_reply?.id
    if (listReplyId) return handleDiscoverListReply(phoneNumberId, from, listReplyId)
  }

  if (msg.type === 'text' && msg.text?.body) {
    const textBody = String(msg.text.body).trim()
    if (state.step === conversationState.STEPS.PUBLISH_ASK_FULL_NAME) {
      conversationState.set(from, { fullName: textBody, step: conversationState.STEPS.PUBLISH_ASK_PUBLISHING_AS })
      return sendText(phoneNumberId, from, PUBLISH_ASK_PUBLISHING_AS)
    }
    if (state.step === conversationState.STEPS.PUBLISH_ASK_PUBLISHING_AS) {
      conversationState.set(from, { publishingAs: textBody, step: conversationState.STEPS.PUBLISH_ASK_EVENT_TYPES })
      return sendText(phoneNumberId, from, PUBLISH_ASK_EVENT_TYPES)
    }
    if (state.step === conversationState.STEPS.PUBLISH_ASK_EVENT_TYPES) {
      conversationState.set(from, {
        eventTypesDescription: textBody,
        step: conversationState.STEPS.PUBLISH_ASK_COMMITMENT,
      })
      return sendInteractiveButtons(phoneNumberId, from, PUBLISH_ASK_COMMITMENT)
    }
    if (state.step === conversationState.STEPS.PUBLISH_ASK_COMMITMENT) {
      return sendInteractiveButtons(phoneNumberId, from, PUBLISH_ASK_COMMITMENT)
    }
  }

  const publishSteps = [
    conversationState.STEPS.PUBLISH_ASK_FULL_NAME,
    conversationState.STEPS.PUBLISH_ASK_PUBLISHING_AS,
    conversationState.STEPS.PUBLISH_ASK_EVENT_TYPES,
    conversationState.STEPS.PUBLISH_ASK_COMMITMENT,
  ]
  if (publishSteps.includes(state.step) && msg.type !== 'text') {
    return sendText(phoneNumberId, from, 'נא להשיב בטקסט.')
  }

  return sendInteractiveButtons(phoneNumberId, from, WELCOME_INTERACTIVE)
}

/**
 * Parse webhook body and process incoming messages. Route by interactive type and conversation state.
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
      const messages = value.messages || []
      const profileName = value.contacts?.[0]?.profile?.name
      for (const msg of messages) {
        if (!isPrivateMessage(msg)) {
          logger.info(LOG_PREFIXES.WEBHOOK, 'Skip non-private message', msg.id)
          continue
        }
        const from = msg.from
        logger.info(LOG_PREFIXES.WEBHOOK, 'Private message from', from)
        setImmediate(() => {
          processOneMessage(phoneNumberId, from, msg, { profileName })
            .then((result) => {
              if (result && !result.success) logger.error(LOG_PREFIXES.WEBHOOK, 'Send result', result.error)
            })
            .catch((err) => {
              logger.error(LOG_PREFIXES.WEBHOOK, 'Failed to send reply', err)
            })
        })
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
 * POST: Incoming webhook payload. Respond 200 quickly; process messages async.
 */
export function handlePost(req, res) {
  let raw = ''
  req.on('data', (chunk) => { raw += chunk })
  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    try {
      const body = JSON.parse(raw || '{}')
      logger.info(LOG_PREFIXES.WEBHOOK, 'POST body received', JSON.stringify(body).slice(0, 500))
      processWebhookBody(body)
    } catch (err) {
      logger.error(LOG_PREFIXES.WEBHOOK, 'Webhook parse error', err)
    }
  })
}

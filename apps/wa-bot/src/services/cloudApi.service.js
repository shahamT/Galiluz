import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES, API_VERSION } from '../consts/index.js'

const BASE_URL = `https://graph.facebook.com/${API_VERSION}`

/**
 * Send interactive list message via WhatsApp Cloud API.
 * @param {string} phoneNumberId - Business phone number ID
 * @param {string} to - Recipient wa_id
 * @param {{ body: string, button: string, sections: Array<{ title: string, rows: Array<{ id: string, title: string, description?: string }> }> }} interactive
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
export async function sendInteractiveList(phoneNumberId, to, interactive) {
  const url = `${BASE_URL}/${phoneNumberId}/messages`
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to.replace(/\D/g, ''),
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: interactive.body },
      action: {
        button: interactive.button,
        sections: interactive.sections.map((sec) => ({
          title: sec.title,
          rows: sec.rows.map((row) => ({
            id: row.id,
            title: row.title,
            ...(row.description && { description: row.description }),
          })),
        })),
      },
    },
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.whatsapp.accessToken}`,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      logger.error(LOG_PREFIXES.CLOUD_API, 'Send interactive list failed', data)
      return { success: false, error: data.error?.message || res.statusText }
    }
    const messageId = data.messages?.[0]?.id
    logger.info(LOG_PREFIXES.CLOUD_API, `Interactive list sent to ${to}, id: ${messageId || 'n/a'}`)
    return { success: true, messageId }
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, err)
    return { success: false, error: err.message }
  }
}

/**
 * Send interactive reply buttons (quick replies) via WhatsApp Cloud API. Max 3 buttons, title max 20 chars.
 * Optional footer.
 * @param {string} phoneNumberId - Business phone number ID
 * @param {string} to - Recipient wa_id
 * @param {{ body: string, footer?: string, buttons: Array<{ id: string, title: string }> }} interactive - Body text, optional footer, and buttons
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
export async function sendInteractiveButtons(phoneNumberId, to, interactive) {
  const url = `${BASE_URL}/${phoneNumberId}/messages`
  const interactivePayload = {
    type: 'button',
    body: { text: interactive.body },
    action: {
      buttons: interactive.buttons.map((btn) => ({
        type: 'reply',
        reply: { id: btn.id, title: btn.title },
      })),
    },
  }
  if (interactive.footer) {
    interactivePayload.footer = { text: interactive.footer }
  }
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to.replace(/\D/g, ''),
    type: 'interactive',
    interactive: interactivePayload,
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.whatsapp.accessToken}`,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      logger.error(LOG_PREFIXES.CLOUD_API, 'Send interactive failed', data)
      return { success: false, error: data.error?.message || res.statusText }
    }
    const messageId = data.messages?.[0]?.id
    logger.info(LOG_PREFIXES.CLOUD_API, `Interactive buttons sent to ${to}, id: ${messageId || 'n/a'}`)
    return { success: true, messageId }
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, err)
    return { success: false, error: err.message }
  }
}

/**
 * Send a text message via WhatsApp Cloud API.
 * @param {string} phoneNumberId - Business phone number ID
 * @param {string} to - Recipient wa_id (e.g. phone number without +)
 * @param {string} body - Message text
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
export async function sendText(phoneNumberId, to, body) {
  const url = `${BASE_URL}/${phoneNumberId}/messages`
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to.replace(/\D/g, ''),
    type: 'text',
    text: { body },
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.whatsapp.accessToken}`,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      logger.error(LOG_PREFIXES.CLOUD_API, 'Send failed', data)
      return { success: false, error: data.error?.message || res.statusText }
    }
    const messageId = data.messages?.[0]?.id
    logger.info(LOG_PREFIXES.CLOUD_API, `Message sent to ${to}, id: ${messageId || 'n/a'}`)
    return { success: true, messageId }
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, err)
    return { success: false, error: err.message }
  }
}

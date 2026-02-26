import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES, API_VERSION } from '../consts/index.js'

const BASE_URL = `https://graph.facebook.com/${API_VERSION}`

/**
 * Send interactive list message via WhatsApp Cloud API.
 * Optional footer (max 60 chars, plain text).
 * @param {string} phoneNumberId - Business phone number ID
 * @param {string} to - Recipient wa_id
 * @param {{ body: string, footer?: string, button: string, sections: Array<{ title: string, rows: Array<{ id: string, title: string, description?: string }> }> }} interactive
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
export async function sendInteractiveList(phoneNumberId, to, interactive) {
  const url = `${BASE_URL}/${phoneNumberId}/messages`
  const interactivePayload = {
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
 * Download media (image/video) from WhatsApp Cloud API by media id.
 * @param {string} mediaId - Media id from msg.image.id or msg.video.id
 * @returns {Promise<{ buffer: Buffer, mimetype: string }|null>} Buffer and mimetype or null on failure
 */
export async function downloadMedia(mediaId) {
  if (!mediaId) return null
  const url = `${BASE_URL}/${mediaId}`
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.whatsapp.accessToken}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      logger.error(LOG_PREFIXES.CLOUD_API, 'Get media URL failed', data)
      return null
    }
    const mediaUrl = data.url
    if (!mediaUrl) {
      logger.error(LOG_PREFIXES.CLOUD_API, 'No url in media response')
      return null
    }
    const mediaRes = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${config.whatsapp.accessToken}` },
    })
    if (!mediaRes.ok) {
      logger.error(LOG_PREFIXES.CLOUD_API, 'Download media failed', mediaRes.status)
      return null
    }
    const buffer = Buffer.from(await mediaRes.arrayBuffer())
    const mimetype = data.mime_type || mediaRes.headers.get('content-type') || 'application/octet-stream'
    return { buffer, mimetype }
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Download media error', err)
    return null
  }
}

/**
 * Send an image message via WhatsApp Cloud API (public URL).
 * @param {string} phoneNumberId - Business phone number ID
 * @param {string} to - Recipient wa_id
 * @param {string} imageUrl - Public URL of the image (must be HTTPS)
 * @param {string} [caption] - Optional caption
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
export async function sendImage(phoneNumberId, to, imageUrl, caption) {
  const url = `${BASE_URL}/${phoneNumberId}/messages`
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to.replace(/\D/g, ''),
    type: 'image',
    image: {
      link: imageUrl,
      ...(typeof caption === 'string' && caption.trim() && { caption: caption.trim() }),
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
      logger.error(LOG_PREFIXES.CLOUD_API, 'Send image failed', data)
      return { success: false, error: data.error?.message || res.statusText }
    }
    const messageId = data.messages?.[0]?.id
    logger.info(LOG_PREFIXES.CLOUD_API, `Image sent to ${to}, id: ${messageId || 'n/a'}`)
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

const REENGAGEMENT_ERROR_CODE = 131047

/**
 * Send a pre-approved template message via WhatsApp Cloud API.
 * Use when the recipient is outside the 24h window (e.g. after error 131047).
 * Template must be created and approved in Meta Business Manager.
 * If the template has a body only, components stay empty. If it has quick reply buttons,
 * we include a button component so the structure matches (index 0, empty parameters for static button).
 * @param {string} phoneNumberId - Business phone number ID
 * @param {string} to - Recipient wa_id
 * @param {string} templateName - Template name as created in Meta
 * @param {string} languageCode - Language code (e.g. 'he', 'en')
 * @param {{ includeQuickReplyButton?: boolean }} opts - Set includeQuickReplyButton: true if template has a quick reply button
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string, errorCode?: number }>}
 */
export async function sendTemplate(phoneNumberId, to, templateName, languageCode = 'he', opts = {}) {
  const url = `${BASE_URL}/${phoneNumberId}/messages`
  const components = []
  if (opts.includeQuickReplyButton) {
    components.push({
      type: 'button',
      sub_type: 'quick_reply',
      index: '0',
      parameters: [],
    })
  }
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to.replace(/\D/g, ''),
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
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
      const code = data.error?.code || data.error?.error_data?.details?.code
      logger.error(LOG_PREFIXES.CLOUD_API, 'Send template failed', data)
      return { success: false, error: data.error?.message || res.statusText, errorCode: code }
    }
    const messageId = data.messages?.[0]?.id
    logger.info(LOG_PREFIXES.CLOUD_API, `Template "${templateName}" sent to ${to}, id: ${messageId || 'n/a'}`)
    return { success: true, messageId }
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, err)
    return { success: false, error: err.message }
  }
}

export { REENGAGEMENT_ERROR_CODE }

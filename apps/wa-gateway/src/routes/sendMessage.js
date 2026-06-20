import { readJsonBody, sendJson } from '../utils/http.js'
import { sendMessage } from '../services/greenApi.service.js'
import { toChatId } from '../utils/phone.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

/**
 * POST /internal/send-message  { phone, message }  (API_SECRET-gated).
 * Generic outbound text — used by the web app to notify a publisher about an
 * auto-created crawler draft. Never logs the message body.
 */
export async function handleSendMessage(req, res) {
  let body
  try {
    body = await readJsonBody(req)
  } catch (err) {
    return sendJson(res, 400, { error: err.message })
  }

  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const message = typeof body.message === 'string' ? body.message : ''
  if (!phone || !message) return sendJson(res, 400, { error: 'phone and message are required' })

  let chatId
  try {
    chatId = toChatId(phone)
  } catch (err) {
    return sendJson(res, 400, { error: 'invalid_phone' })
  }

  try {
    const result = await sendMessage(chatId, message)
    logger.info(LOG_PREFIXES.CRAWLER, `notified ${chatId} (idMessage: ${result?.idMessage || 'n/a'})`)
    return sendJson(res, 200, { success: true, idMessage: result?.idMessage || null })
  } catch (err) {
    logger.error(LOG_PREFIXES.CRAWLER, `send-message failed for ${chatId}: ${err instanceof Error ? err.message : String(err)}`)
    return sendJson(res, 502, { error: 'send_failed' })
  }
}

import { readJsonBody, sendJson } from '../utils/http.js'
import { sendMessage } from '../services/greenApi.service.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

/**
 * POST /internal/log  { message }  (API_SECRET-gated).
 * Posts a plain, action-less operational notice to the dedicated WhatsApp "log" group
 * (config.logGroupChatId). If no log group is configured it's a graceful no-op.
 */
export async function handleLog(req, res) {
  let body
  try {
    body = await readJsonBody(req)
  } catch (err) {
    return sendJson(res, 400, { error: err.message })
  }

  const message = typeof body.message === 'string' ? body.message : ''
  if (!message) return sendJson(res, 400, { error: 'message is required' })

  const chatId = config.logGroupChatId
  if (!chatId) {
    logger.warn(LOG_PREFIXES.LOG, 'LOG_GROUP_CHAT_ID not set — log notice skipped')
    return sendJson(res, 200, { success: false, skipped: 'no_log_group' })
  }

  try {
    const result = await sendMessage(chatId, message)
    logger.info(LOG_PREFIXES.LOG, `📋 posted to log group (idMessage: ${result?.idMessage || 'n/a'})`)
    return sendJson(res, 200, { success: true, idMessage: result?.idMessage || null })
  } catch (err) {
    logger.error(LOG_PREFIXES.LOG, `log post failed: ${err instanceof Error ? err.message : String(err)}`)
    return sendJson(res, 502, { error: 'send_failed' })
  }
}

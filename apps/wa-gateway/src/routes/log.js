import { readJsonBody, sendJson } from '../utils/http.js'
import { sendMessage } from '../services/greenApi.service.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

/**
 * POST /internal/log  { message, groupChatId? }  (API_SECRET-gated).
 * Posts a plain, action-less operational notice to a WhatsApp group. The caller may target a
 * specific group via `groupChatId` (e.g. the crawler-decision log group selected in the admin
 * page); otherwise it falls back to the default "log" group (config.logGroupChatId). If neither
 * is set it's a graceful no-op.
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

  const requested = typeof body.groupChatId === 'string' ? body.groupChatId.trim() : ''
  const chatId = requested || config.logGroupChatId
  if (!chatId) {
    logger.warn(LOG_PREFIXES.LOG, 'no target group (groupChatId / LOG_GROUP_CHAT_ID) — log notice skipped')
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

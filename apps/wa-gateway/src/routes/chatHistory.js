import { readJsonBody, sendJson } from '../utils/http.js'
import { getChatHistory } from '../services/greenApi.service.js'
import { toChatId } from '../utils/phone.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

/**
 * POST /internal/chat-history  { phone, count }  (API_SECRET-gated).
 * Returns the last `count` DM messages with a publisher (both directions), normalized to
 * { id, direction:'in'|'out', text, timestamp }. No storage — fetched live from Green API.
 */
export async function handleChatHistory(req, res) {
  let body
  try {
    body = await readJsonBody(req)
  } catch (err) {
    return sendJson(res, 400, { error: err.message })
  }

  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const count = Math.min(Math.max(parseInt(body.count, 10) || 20, 1), 100)
  if (!phone) return sendJson(res, 400, { error: 'phone is required' })

  let chatId
  try {
    chatId = toChatId(phone)
  } catch {
    return sendJson(res, 400, { error: 'invalid_phone' })
  }

  try {
    const history = await getChatHistory(chatId, count)
    const messages = (Array.isArray(history) ? history : []).map((m) => ({
      id: m.idMessage || '',
      direction: m.type === 'outgoing' ? 'out' : 'in',
      text: m.textMessage || m.extendedTextMessage?.text || m.extendedTextMessageData?.text || m.caption || '',
      timestamp: m.timestamp || null,
      typeMessage: m.typeMessage || '',
    }))
    return sendJson(res, 200, { messages })
  } catch (err) {
    logger.error(LOG_PREFIXES.GREEN_API, `chat-history failed for ${chatId}: ${err instanceof Error ? err.message : String(err)}`)
    return sendJson(res, 502, { error: 'history_failed' })
  }
}

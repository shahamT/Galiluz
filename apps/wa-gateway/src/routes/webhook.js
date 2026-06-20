import { readJsonBody, sendJson } from '../utils/http.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'
import { config } from '../config.js'
import { getWatchedCache, forwardToIngest } from '../services/crawler.service.js'

/**
 * POST /webhook/green-api — Green API incoming-notification webhook.
 *
 * Handles `incomingMessageReceived` for GROUP messages: extracts sender + text +
 * image, filters to watched groups (cache), and forwards to the web ingest
 * pipeline. Always acks 200 immediately so Green API doesn't retry; processing
 * is best-effort afterwards. Verifies the Green API webhook token when set.
 */
export async function handleWebhook(req, res) {
  // Optional shared-token check (Green API sends Authorization: Bearer <webhookUrlToken>).
  if (config.greenApi.webhookToken) {
    const auth = req.headers['authorization'] || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (token !== config.greenApi.webhookToken) {
      return sendJson(res, 401, { error: 'unauthorized' })
    }
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    return sendJson(res, 200, { ok: true })
  }

  // Ack first — never block the webhook on the pipeline.
  sendJson(res, 200, { ok: true })

  try {
    logger.info(LOG_PREFIXES.WEBHOOK, `received typeWebhook=${body?.typeWebhook}`)
    if (body?.typeWebhook !== 'incomingMessageReceived') return

    const senderData = body.senderData || {}
    const chatId = String(senderData.chatId || '')
    if (!chatId.endsWith('@g.us')) { logger.info(LOG_PREFIXES.WEBHOOK, `skip non-group chatId=${chatId}`); return } // only group messages

    const md = body.messageData || {}
    const text = md.textMessageData?.textMessage
      || md.extendedTextMessageData?.text
      || md.fileMessageData?.caption
      || ''
    const imageUrl = md.typeMessage === 'imageMessage' ? (md.fileMessageData?.downloadUrl || '') : ''
    const mimeType = md.fileMessageData?.mimeType || ''
    const senderPhone = String(senderData.sender || '').replace(/\D/g, '')

    // Watched-group filter (cache). Before the first successful sync, forward all
    // (the web ingest re-validates authoritatively).
    const cache = getWatchedCache()
    if (cache.synced && (!cache.enabled || !cache.groupChatIds.has(chatId))) {
      logger.info(LOG_PREFIXES.WEBHOOK, `skip ${chatId} (enabled=${cache.enabled}, watched=${cache.groupChatIds.has(chatId)})`)
      return
    }

    if (!text && !imageUrl) { logger.info(LOG_PREFIXES.WEBHOOK, 'skip — no text/image'); return }

    logger.info(LOG_PREFIXES.WEBHOOK, `forwarding group=${chatId} sender=${senderPhone}`)
    await forwardToIngest({ groupChatId: chatId, senderPhone, text, imageUrl, mimeType, idMessage: body.idMessage })
  } catch (err) {
    logger.error(LOG_PREFIXES.WEBHOOK, `processing error: ${err instanceof Error ? err.message : String(err)}`)
  }
}

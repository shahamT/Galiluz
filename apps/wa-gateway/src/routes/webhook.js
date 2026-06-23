import { timingSafeEqual } from 'node:crypto'
import { readJsonBody, sendJson } from '../utils/http.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'
import { config } from '../config.js'
import { getWatchedCache, forwardToIngest } from '../services/crawler.service.js'

/** Throttle the (noisy) quotaExceeded warning to once per minute. */
let lastQuotaWarnAt = 0

/** Constant-time string equality — avoids leaking the token via response timing. */
function safeEqual(a, b) {
  const ab = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * POST /webhook/green-api — Green API incoming-notification webhook.
 *
 * Handles `incomingMessageReceived` for GROUP messages: extracts sender + text +
 * image, filters to watched groups (cache), and forwards to the web ingest
 * pipeline. Always acks 200 immediately so Green API doesn't retry; processing
 * is best-effort afterwards. REQUIRES the Green API webhook token — fails closed
 * if it is not configured (the route is public).
 */
export async function handleWebhook(req, res) {
  // Fail closed: the public webhook must be authenticated. With no token configured
  // we refuse rather than silently accept unauthenticated webhooks (which could
  // inject crafted "incoming messages" into the crawler pipeline).
  if (!config.greenApi.webhookToken) {
    logger.error(LOG_PREFIXES.WEBHOOK, 'rejected — GREEN_API_WEBHOOK_TOKEN not configured')
    return sendJson(res, 503, { error: 'webhook_not_configured' })
  }
  // Green API sends Authorization: Bearer <webhookUrlToken>.
  const auth = req.headers['authorization'] || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!safeEqual(token, config.greenApi.webhookToken)) {
    return sendJson(res, 401, { error: 'unauthorized' })
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
    const tw = body?.typeWebhook
    if (tw === 'quotaExceeded') {
      // Green API can fire this repeatedly while over quota. Throttle to one ⚠️/min; a send
      // can be ACCEPTED (200 + idMessage) yet NOT delivered while the instance is over quota.
      const ts = Date.now()
      if (ts - lastQuotaWarnAt > 60000) {
        lastQuotaWarnAt = ts
        // Include the quotaData payload (method/used/total/status) so it can be shared with support.
        logger.warn(LOG_PREFIXES.WEBHOOK, `Green API quotaExceeded — instance over plan quota; messages may be accepted but NOT delivered :: ${JSON.stringify(body.quotaData || body)}`)
      }
      return
    }
    // Only group incoming messages drive the crawler; everything else is trace-level noise.
    if (tw !== 'incomingMessageReceived') { logger.debug(LOG_PREFIXES.WEBHOOK, `ignored typeWebhook=${tw}`); return }

    const senderData = body.senderData || {}
    const chatId = String(senderData.chatId || '')
    if (!chatId.endsWith('@g.us')) { logger.debug(LOG_PREFIXES.WEBHOOK, `skip non-group chatId=${chatId}`); return } // only group messages

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
      logger.debug(LOG_PREFIXES.WEBHOOK, `skip ${chatId} (enabled=${cache.enabled}, watched=${cache.groupChatIds.has(chatId)})`)
      return
    }

    if (!text && !imageUrl) { logger.debug(LOG_PREFIXES.WEBHOOK, 'skip — no text/image'); return }

    logger.debug(LOG_PREFIXES.WEBHOOK, `forwarding group=${chatId} sender=${senderPhone}`)
    await forwardToIngest({ groupChatId: chatId, senderPhone, text, imageUrl, mimeType, idMessage: body.idMessage })
  } catch (err) {
    logger.error(LOG_PREFIXES.WEBHOOK, `processing error: ${err instanceof Error ? err.message : String(err)}`)
  }
}

import { readJsonBody, sendJson } from '../utils/http.js'
import { sendMessage, sendFileByUrl } from '../services/greenApi.service.js'
import { toChatId } from '../utils/phone.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

// Personalization tags inserted by the admin broadcast editor. Replaced per recipient
// here (not on the web) so the payload stays compact — a template + short name fields,
// instead of N fully-rendered messages (which would blow past readJsonBody's 64 KB cap).
// These literals MUST match the web side (server/api/admin/broadcast.post.ts).
const TAG_ACCOUNT = '<שם החשבון>'
const TAG_PUBLISHER = '<שם המפרסם>'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Random delay (ms) within the configured min..max window, between individual sends. */
function randDelay() {
  const lo = Math.min(config.broadcast.minDelayMs, config.broadcast.maxDelayMs)
  const hi = Math.max(config.broadcast.minDelayMs, config.broadcast.maxDelayMs)
  return lo + Math.floor(Math.random() * (hi - lo + 1))
}

/** Replace the two personalization tags. Account tag → account name (fallback full name); publisher tag → full name (fallback account name). */
function renderMessage(template, { accountName = '', fullName = '' }) {
  const account = accountName || fullName || ''
  const publisher = fullName || accountName || ''
  return template.split(TAG_ACCOUNT).join(account).split(TAG_PUBLISHER).join(publisher)
}

/**
 * Paced send loop — sequential, with a randomized delay between each recipient and a
 * longer pause every batch, to keep the (unofficial) WhatsApp number under WhatsApp's
 * radar. Runs detached from the HTTP response (fire-and-forget); per-recipient errors
 * are logged and skipped. In-memory only: a gateway restart drops the remainder.
 */
async function runBroadcast(recipients, message, imageUrl, fileName) {
  const { batchSize, batchPauseMs } = config.broadcast
  let sent = 0
  let failed = 0
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i]
    let chatId
    try {
      chatId = toChatId(r.phone)
    } catch {
      failed++
      logger.warn(LOG_PREFIXES.BROADCAST, `skip recipient ${i + 1}: invalid phone`)
      continue
    }
    const text = renderMessage(message, r)
    try {
      if (imageUrl) await sendFileByUrl(chatId, imageUrl, fileName, text)
      else await sendMessage(chatId, text)
      sent++
    } catch (err) {
      failed++
      logger.error(LOG_PREFIXES.BROADCAST, `send failed for recipient ${i + 1}: ${err instanceof Error ? err.message : String(err)}`)
    }
    // Pace before the next recipient (no wait after the last one).
    if (i < recipients.length - 1) {
      const isBatchEnd = batchSize > 0 && (i + 1) % batchSize === 0
      const wait = isBatchEnd ? batchPauseMs : randDelay()
      if (isBatchEnd) logger.info(LOG_PREFIXES.BROADCAST, `batch of ${batchSize} done (${i + 1}/${recipients.length}) — pausing ${Math.round(wait / 1000)}s`)
      await sleep(wait)
    }
  }
  logger.info(LOG_PREFIXES.BROADCAST, `done — sent ${sent}, failed ${failed}, total ${recipients.length}`)
}

/**
 * POST /internal/broadcast  (API_SECRET-gated).
 * Body: { recipients: [{ phone, accountName?, fullName? }], message, imageUrl?, fileName? }.
 * Responds 202 immediately with the queued count; sends are paced in the background.
 * Never logs message bodies or full phone numbers.
 */
export async function handleBroadcast(req, res) {
  let body
  try {
    body = await readJsonBody(req)
  } catch (err) {
    return sendJson(res, 400, { error: err.message })
  }

  const message = typeof body.message === 'string' ? body.message : ''
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''
  const fileName = typeof body.fileName === 'string' && body.fileName.trim() ? body.fileName.trim() : 'image.jpg'
  const recipients = (Array.isArray(body.recipients) ? body.recipients : [])
    .filter((r) => r && typeof r.phone === 'string' && r.phone.trim())
    .map((r) => ({
      phone: r.phone.trim(),
      accountName: typeof r.accountName === 'string' ? r.accountName : '',
      fullName: typeof r.fullName === 'string' ? r.fullName : '',
    }))

  if (!recipients.length) return sendJson(res, 400, { error: 'recipients required' })
  if (!message && !imageUrl) return sendJson(res, 400, { error: 'message or imageUrl required' })

  // Acknowledge now; pace the actual sends in the background.
  sendJson(res, 202, { queued: recipients.length })
  logger.info(LOG_PREFIXES.BROADCAST, `queued ${recipients.length} recipients${imageUrl ? ' (with image)' : ''}`)
  runBroadcast(recipients, message, imageUrl, fileName).catch((err) =>
    logger.error(LOG_PREFIXES.BROADCAST, `run crashed: ${err instanceof Error ? err.message : String(err)}`),
  )
}

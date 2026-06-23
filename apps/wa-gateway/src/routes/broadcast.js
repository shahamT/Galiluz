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
 * Report live progress back to the web (which owns Mongo) — same gateway→web pattern as the
 * crawler. Best-effort: never throws, so a lost report can't break the send loop; the next
 * report (or the final done=true) corrects the counts. No-op without a broadcastId / web url.
 */
async function reportProgress(broadcastId, sentCount, failedIds, done) {
  if (!broadcastId || !config.webAppUrl || !config.apiSecret) return
  try {
    await fetch(`${config.webAppUrl}/api/internal/broadcast-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiSecret },
      body: JSON.stringify({ broadcastId, sentCount, failedIds, done }),
    })
  } catch (err) {
    logger.warn(LOG_PREFIXES.BROADCAST, `progress report failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Paced send loop — sequential, with a randomized delay between each recipient and a
 * longer pause every batch, to keep the (unofficial) WhatsApp number under WhatsApp's
 * radar. Runs detached from the HTTP response; per-recipient errors are recorded (the
 * publisher id is collected in failedIds) and skipped. Reports progress to the web after
 * each recipient + a final authoritative report. In-memory only: a restart drops the rest.
 */
async function runBroadcast(broadcastId, recipients, message, imageUrl, fileName) {
  const { batchSize, batchPauseMs } = config.broadcast
  let sent = 0
  const failedIds = []
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i]
    let chatId
    try {
      chatId = toChatId(r.phone)
    } catch {
      failedIds.push(r.id)
      logger.warn(LOG_PREFIXES.BROADCAST, `skip recipient ${i + 1}: invalid phone`)
      reportProgress(broadcastId, sent, failedIds, false)
      continue
    }
    const text = renderMessage(message, r)
    try {
      if (imageUrl) await sendFileByUrl(chatId, imageUrl, fileName, text)
      else await sendMessage(chatId, text)
      sent++
    } catch (err) {
      failedIds.push(r.id)
      logger.error(LOG_PREFIXES.BROADCAST, `send failed for recipient ${i + 1}: ${err instanceof Error ? err.message : String(err)}`)
    }
    reportProgress(broadcastId, sent, failedIds, false) // fire-and-forget per-message update
    // Pace before the next recipient (no wait after the last one).
    if (i < recipients.length - 1) {
      const isBatchEnd = batchSize > 0 && (i + 1) % batchSize === 0
      const wait = isBatchEnd ? batchPauseMs : randDelay()
      if (isBatchEnd) logger.info(LOG_PREFIXES.BROADCAST, `batch of ${batchSize} done (${i + 1}/${recipients.length}) — pausing ${Math.round(wait / 1000)}s`)
      await sleep(wait)
    }
  }
  logger.info(LOG_PREFIXES.BROADCAST, `📣 broadcast done — sent ${sent}, failed ${failedIds.length}, total ${recipients.length}`)
  await reportProgress(broadcastId, sent, failedIds, true) // authoritative final report
}

/**
 * POST /internal/broadcast  (API_SECRET-gated).
 * Body: { broadcastId?, recipients: [{ id, phone, accountName?, fullName? }], message, imageUrl?, fileName? }.
 * Responds 202 immediately with the queued count; sends are paced in the background and
 * progress (sentCount + failed publisher ids) is reported back to the web per message.
 * Never logs message bodies or full phone numbers.
 */
export async function handleBroadcast(req, res) {
  let body
  try {
    body = await readJsonBody(req)
  } catch (err) {
    return sendJson(res, 400, { error: err.message })
  }

  const broadcastId = typeof body.broadcastId === 'string' ? body.broadcastId.trim() : ''
  const message = typeof body.message === 'string' ? body.message : ''
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''
  const fileName = typeof body.fileName === 'string' && body.fileName.trim() ? body.fileName.trim() : 'image.jpg'
  const recipients = (Array.isArray(body.recipients) ? body.recipients : [])
    .filter((r) => r && typeof r.phone === 'string' && r.phone.trim())
    .map((r) => ({
      id: typeof r.id === 'string' ? r.id : '',
      phone: r.phone.trim(),
      accountName: typeof r.accountName === 'string' ? r.accountName : '',
      fullName: typeof r.fullName === 'string' ? r.fullName : '',
    }))

  if (!recipients.length) return sendJson(res, 400, { error: 'recipients required' })
  if (!message && !imageUrl) return sendJson(res, 400, { error: 'message or imageUrl required' })

  // Acknowledge now; pace the actual sends in the background.
  sendJson(res, 202, { queued: recipients.length })
  logger.info(LOG_PREFIXES.BROADCAST, `📣 broadcast queued: ${recipients.length} recipients${imageUrl ? ' (with image)' : ''}`)
  runBroadcast(broadcastId, recipients, message, imageUrl, fileName).catch((err) =>
    logger.error(LOG_PREFIXES.BROADCAST, `run crashed: ${err instanceof Error ? err.message : String(err)}`),
  )
}

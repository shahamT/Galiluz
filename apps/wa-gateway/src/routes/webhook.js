import { readJsonBody, sendJson } from '../utils/http.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

/**
 * POST /webhook/green-api — STUB.
 *
 * Future: Green API posts incoming notifications here (messages, group events,
 * statuses) once the instance is configured with this URL. Always reply 200 so
 * Green API marks the notification delivered. Real routing (group ingestion,
 * action handlers) lands in a later phase.
 */
export async function handleWebhook(req, res) {
  try {
    const body = await readJsonBody(req)
    logger.info(LOG_PREFIXES.WEBHOOK, `Incoming (stub): ${body?.typeWebhook || 'unknown'}`)
  } catch {
    // Ignore parse errors — still ack so Green API doesn't retry forever.
  }
  sendJson(res, 200, { ok: true })
}

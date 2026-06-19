import { sendJson } from '../utils/http.js'
import { getStateInstance, getSettings } from '../services/greenApi.service.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

/**
 * GET /internal/diagnostics — on-demand Green API instance health (API_SECRET-gated).
 * Returns the instance auth state + settings so accepted-but-undelivered issues
 * (notAuthorized, yellowCard/blocked, wrong linked number, webhook config) are
 * visible without scraping logs.
 *   stateInstance values: authorized | notAuthorized | blocked | sleepMode |
 *                         starting | yellowCard
 */
export async function handleDiagnostics(req, res) {
  const [state, settings] = await Promise.all([
    getStateInstance().catch((e) => ({ error: String(e?.message || e) })),
    getSettings().catch((e) => ({ error: String(e?.message || e) })),
  ])
  logger.info(LOG_PREFIXES.GREEN_API, `Diagnostics: state=${JSON.stringify(state)} settings=${JSON.stringify(settings)}`)
  return sendJson(res, 200, { state, settings })
}

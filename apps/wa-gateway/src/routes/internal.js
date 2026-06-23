import { readJsonBody, sendJson } from '../utils/http.js'
import { sendOtp } from '../services/otp.service.js'
import { getStateInstance } from '../services/greenApi.service.js'
import { toChatId } from '../utils/phone.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

/**
 * POST /internal/otp  { phone, otp }
 * API_SECRET is verified by the server before dispatch. Sends the OTP over
 * WhatsApp via Green API. Never logs the code itself.
 *
 * Logs the resolved chatId AND the instance state on every send: Green API
 * returns an idMessage as soon as it ACCEPTS a message, so an undelivered OTP
 * (instance in "notAuthorized"/"yellowCard", recipient not on WhatsApp, etc.)
 * only shows up by correlating state + response.
 */
export async function handleOtp(req, res) {
  let body
  try {
    body = await readJsonBody(req)
  } catch (err) {
    return sendJson(res, 400, { error: err.message })
  }

  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const otp = typeof body.otp === 'string' ? body.otp.trim() : (typeof body.otp === 'number' ? String(body.otp) : '')
  if (!phone || !otp) {
    return sendJson(res, 400, { error: 'phone and otp are required' })
  }

  let chatId
  try {
    chatId = toChatId(phone)
  } catch (err) {
    logger.error(LOG_PREFIXES.OTP, `Invalid phone "${phone}": ${err instanceof Error ? err.message : String(err)}`)
    return sendJson(res, 400, { error: 'invalid_phone' })
  }

  // Read the instance state so accepted-but-undelivered cases are visible.
  const state = await getStateInstance().then((s) => s?.stateInstance || 'unknown').catch(() => 'unreachable')
  if (state !== 'authorized') {
    logger.warn(LOG_PREFIXES.OTP, `Instance state is "${state}" (not "authorized") — Green API may accept the message but NOT deliver it`)
  }

  try {
    const result = await sendOtp(phone, otp)
    logger.info(LOG_PREFIXES.OTP, `🔑 OTP sent to ${chatId} | instance=${state} | idMessage=${result?.idMessage || 'none'}`)
    if (!result?.idMessage) {
      logger.warn(LOG_PREFIXES.OTP, `No idMessage returned for ${chatId} — Green API likely rejected the send`)
    }
    return sendJson(res, 200, { success: true, idMessage: result?.idMessage || null, instanceState: state })
  } catch (err) {
    logger.error(LOG_PREFIXES.OTP, `Failed to send to ${chatId} (instance=${state}): ${err instanceof Error ? err.message : String(err)}`)
    return sendJson(res, 502, { error: 'send_failed' })
  }
}

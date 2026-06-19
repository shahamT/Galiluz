import { readJsonBody, sendJson } from '../utils/http.js'
import { sendOtp } from '../services/otp.service.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

/**
 * POST /internal/otp  { phone, otp }
 * API_SECRET is verified by the server before dispatch. Sends the OTP over
 * WhatsApp via Green API. Never echoes the code back.
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

  try {
    const result = await sendOtp(phone, otp)
    logger.info(LOG_PREFIXES.OTP, `Sent OTP to ${phone} (idMessage: ${result?.idMessage || 'n/a'})`)
    return sendJson(res, 200, { success: true, idMessage: result?.idMessage || null })
  } catch (err) {
    logger.error(LOG_PREFIXES.OTP, `Failed to send OTP to ${phone}: ${err instanceof Error ? err.message : String(err)}`)
    return sendJson(res, 502, { error: 'send_failed' })
  }
}

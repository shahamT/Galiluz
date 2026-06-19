import { sendMessage } from './greenApi.service.js'
import { toChatId } from '../utils/phone.js'

/** OTP message wording lives here so all WhatsApp copy stays in the gateway. */
export function buildOtpMessage(code) {
  return `קוד האימות שלך לגלילו"ז: *${code}*\nהקוד תקף ל-10 דקות.`
}

/**
 * Send an OTP code to a phone number via WhatsApp (Green API).
 * @param {string} phone - e.g. 972526052835
 * @param {string} code  - the verification code
 * @returns {Promise<object>} Green API response (e.g. { idMessage })
 */
export function sendOtp(phone, code) {
  return sendMessage(toChatId(phone), buildOtpMessage(code))
}

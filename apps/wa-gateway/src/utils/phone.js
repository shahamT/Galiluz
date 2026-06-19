/**
 * Convert a phone number to a Green API individual chatId.
 * Green API expects `<international digits, no +>@c.us`, e.g. 972526052835@c.us.
 * The web app already sends normalized `972XXXXXXXXX` waIds; we still strip
 * defensively and validate a plausible length.
 * @returns {string} chatId
 * @throws if the number has no plausible digit sequence
 */
export function toChatId(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) {
    throw new Error(`invalid phone number: "${phone}"`)
  }
  return `${digits}@c.us`
}

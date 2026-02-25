/**
 * Webhook routing: extract phone_number_id and decide whether to forward test payloads to dev (ngrok).
 * Used so production can keep one Meta webhook URL while test-number traffic is forwarded to local.
 */

/**
 * Extract phone_number_id from WhatsApp webhook payload (first entry/change).
 * @param {object} payload - Parsed webhook JSON body
 * @returns {string|null}
 */
export function getPhoneNumberId(payload) {
  const id = payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id
  return id != null && typeof id === 'string' ? id : null
}

/**
 * Whether to forward this request to the dev server (ngrok).
 * True only when: forward enabled, payload is for test number, forward URL set, and request not already forwarded.
 * @param {object} config - App config (whatsappDevForwardEnabled, whatsappTestPhoneNumberId, whatsappDevForwardUrl)
 * @param {string|null} phoneNumberId - From getPhoneNumberId(payload)
 * @param {string|undefined} forwardedHeader - req.headers['x-dev-forwarded'] (case-insensitive)
 * @returns {boolean}
 */
export function shouldForwardToDev(config, phoneNumberId, forwardedHeader) {
  if (!config.whatsappDevForwardEnabled) return false
  if (phoneNumberId !== config.whatsappTestPhoneNumberId) return false
  if (!config.whatsappDevForwardUrl) return false
  const header = forwardedHeader != null ? String(forwardedHeader).trim() : ''
  if (header === '1') return false
  return true
}

/**
 * Fire-and-forget POST of raw webhook body to dev forward URL. Does not block; logs errors.
 * @param {string} rawBody - Original raw request body (string)
 * @param {object} config - App config (whatsappDevForwardUrl, whatsappDevForwardPath)
 * @param {object} logger - Logger with .error(prefix, message, err)
 * @param {string} [logPrefix] - Prefix for error log (e.g. LOG_PREFIXES.WEBHOOK)
 */
export function forwardToDev(rawBody, config, logger, logPrefix = 'Webhook') {
  let base = (config.whatsappDevForwardUrl || '').trim()
  // If value was pasted as KEY=value (e.g. from .env), use only the URL part
  if (base.includes('=')) {
    const afterEq = base.slice(base.indexOf('=') + 1).trim()
    if (afterEq.startsWith('http://') || afterEq.startsWith('https://')) base = afterEq
  }
  base = base.replace(/\/$/, '')
  const path = (config.whatsappDevForwardPath || '/webhook').trim() || '/webhook'
  const pathNorm = path.startsWith('/') ? path : `/${path}`
  let url
  try {
    const parsed = new URL(base)
    if (parsed.pathname && parsed.pathname !== '/') {
      url = base
    } else {
      url = `${base}${pathNorm}`
    }
  } catch {
    url = `${base}${pathNorm}`
  }

  fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-dev-forwarded': '1',
    },
    body: rawBody,
  }).catch((err) => {
    logger.error(logPrefix, 'Dev forward failed', err)
  })
}

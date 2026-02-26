import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verify Meta webhook signature (X-Hub-Signature-256).
 * Meta signs the raw POST body with HMAC-SHA256 using the app's App Secret.
 * @param {string|Buffer} rawBody - Raw request body (as received, UTF-8 string or Buffer)
 * @param {string|undefined} signatureHeader - Value of X-Hub-Signature-256 header (format: sha256=<hex>)
 * @param {string} secret - App Secret from Meta for Developers
 * @returns {boolean} True only if header is present, format is sha256=<hex>, and HMAC matches (constant-time)
 */
export function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!secret || typeof secret !== 'string') return false
  if (!signatureHeader || typeof signatureHeader !== 'string') return false
  const prefix = 'sha256='
  if (!signatureHeader.startsWith(prefix)) return false
  const receivedHex = signatureHeader.slice(prefix.length).trim().toLowerCase()
  if (!/^[a-f0-9]+$/.test(receivedHex)) return false

  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8')
  const expectedBuffer = createHmac('sha256', secret).update(bodyBuffer).digest()
  const receivedBuffer = Buffer.from(receivedHex, 'hex')
  if (expectedBuffer.length !== receivedBuffer.length) return false
  return timingSafeEqual(expectedBuffer, receivedBuffer)
}

import { sendJson } from '../utils/http.js'

/**
 * Liveness probe for Render. Intentionally cheap and independent of Green API
 * state — a Green API hiccup must NOT make Render kill the instance. Green API
 * authorization is logged at boot and can be inspected via getStateInstance.
 */
export function handleHealth(req, res) {
  sendJson(res, 200, { ok: true, service: 'wa-gateway' })
}

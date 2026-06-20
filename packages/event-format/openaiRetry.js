/**
 * Shared OpenAI retry/backoff helpers for the event-format package.
 *
 * The codebase historically duplicated an `isRetryableOpenAIError` that only
 * inspected `err.status` (429/408/5xx). That MISSES connection-layer failures —
 * "Premature close", socket hang up, ECONNRESET, fetch timeouts — which arrive
 * with NO HTTP status and are exactly the transient drops worth retrying. This
 * helper retries those too.
 */

const RETRYABLE_CODES = /^(ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|ENOTFOUND|EAI_AGAIN|UND_ERR)/i
const RETRYABLE_MESSAGES = /(premature close|socket hang up|network|fetch failed|terminated|aborted|connection error|timeout|timed out|ECONNRESET|EPIPE)/i

/** True for transient OpenAI failures worth retrying: rate limit, server errors, and connection drops. */
export function isRetryableOpenAIError(err) {
  const status = err?.status
  if (status === 429 || status === 408) return true
  if (typeof status === 'number' && status >= 500) return true
  // No HTTP status → a transport/connection error (OpenAI SDK APIConnectionError,
  // APIConnectionTimeoutError, or a raw undici/network error). These are transient.
  if (status == null) {
    const name = String(err?.name || '')
    const code = String(err?.code || err?.cause?.code || '')
    const msg = String(err?.message || err?.cause?.message || '')
    if (/APIConnection|Connection(Timeout)?Error|TimeoutError/i.test(name)) return true
    if (RETRYABLE_CODES.test(code)) return true
    if (RETRYABLE_MESSAGES.test(msg)) return true
  }
  return false
}

/** Backoff before the next attempt: honor a 429 "try again in Nms" hint, else exponential (cap 30s). */
export function getRetryDelayMs(err, attemptIndex) {
  const status = err?.status
  const message = err?.message
  if (status === 429 && message) {
    const match = String(message).match(/try again in (\d+)ms/i)
    if (match) return Math.min(60_000, Math.max(500, Number(match[1])))
    return 2000
  }
  return Math.min(30_000, 1000 * 2 ** attemptIndex)
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Serialize an OpenAI/undici error into a structured, log-safe object — walking the
 * `cause` chain so the real transport code surfaces (undici nests it: APIConnectionError
 * → "fetch failed" → { code: 'UND_ERR_SOCKET' | 'ECONNRESET' | … }). This is what tells
 * apart a connection drop, a TLS reset, a DNS failure, a proxy abort, and an HTTP status.
 */
export function describeOpenAIError(err) {
  const seen = new Set()
  const chain = []
  let cur = err
  while (cur && typeof cur === 'object' && !seen.has(cur) && chain.length < 6) {
    seen.add(cur)
    chain.push({
      name: cur.name,
      message: typeof cur.message === 'string' ? cur.message.slice(0, 300) : undefined,
      code: cur.code,
      errno: cur.errno,
      syscall: cur.syscall,
      status: cur.status,
      type: cur.type,
    })
    cur = cur.cause
  }
  const top = chain[0] || {}
  return {
    name: top.name,
    message: top.message,
    code: top.code,
    status: top.status,
    chain,
    stack: typeof err?.stack === 'string' ? err.stack.split('\n').slice(0, 5).join(' | ') : undefined,
  }
}

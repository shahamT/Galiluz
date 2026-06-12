import { sendNotificationMail } from '~/server/utils/mailer'

/**
 * Structured server error logging: every unhandled API error is logged as a
 * single JSON line with route, status, and correlation id — greppable and
 * ready for a log aggregator. (Sentry, when configured, complements this.)
 *
 * 5xx errors also email the site owner (via mailer.ts, env-gated), with
 * storm protection: one email per error signature per 15 minutes and at
 * most 10 error emails per hour overall; suppressed occurrences are
 * counted and reported in the next email that goes through.
 */

const SIGNATURE_WINDOW_MS = 15 * 60 * 1000
const GLOBAL_HOURLY_CAP = 10

const lastSentBySignature = new Map<string, number>()
let hourWindowStart = 0
let sentThisHour = 0
let suppressedSinceLastMail = 0

function shouldEmail(signature: string, now: number): boolean {
  if (now - hourWindowStart > 60 * 60 * 1000) {
    hourWindowStart = now
    sentThisHour = 0
  }
  const last = lastSentBySignature.get(signature) || 0
  if (now - last < SIGNATURE_WINDOW_MS || sentThisHour >= GLOBAL_HOURLY_CAP) {
    suppressedSinceLastMail++
    return false
  }
  lastSentBySignature.set(signature, now)
  sentThisHour++
  // Bound the map (signatures are low-cardinality, but be safe)
  if (lastSentBySignature.size > 200) {
    const oldest = [...lastSentBySignature.entries()].sort((a, b) => a[1] - b[1])[0]
    if (oldest) lastSentBySignature.delete(oldest[0])
  }
  return true
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, { event }) => {
    const statusCode = (error as { statusCode?: number })?.statusCode ?? 500
    // 4xx are expected client errors (validation, auth, rate limits) — only log server faults
    if (statusCode < 500) return

    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack?.split('\n').slice(0, 5).join(' | ') : undefined

    console.error(JSON.stringify({
      level: 'error',
      time: new Date().toISOString(),
      method: event?.method,
      path: event?.path,
      statusCode,
      message,
      correlationId: event?.context?.correlationId,
      stack,
    }))

    const now = Date.now()
    const signature = `${statusCode}|${event?.path || ''}|${message.slice(0, 100)}`
    if (!shouldEmail(signature, now)) return

    const suppressedNote = suppressedSinceLastMail > 0
      ? `\n(+${suppressedSinceLastMail} suppressed errors since the previous email)`
      : ''
    suppressedSinceLastMail = 0

    sendNotificationMail({
      subject: `Galiluz server error ${statusCode} — ${event?.path || 'unknown route'}`,
      text: [
        `Time: ${new Date(now).toISOString()}`,
        `Route: ${event?.method || '?'} ${event?.path || '?'}`,
        `Status: ${statusCode}`,
        `Message: ${message}`,
        `Correlation-Id: ${event?.context?.correlationId || '-'}`,
        stack ? `Stack: ${stack}` : '',
        suppressedNote,
      ].filter(Boolean).join('\n'),
    }).catch(() => {})
  })
})

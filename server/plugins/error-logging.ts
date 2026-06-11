/**
 * Structured server error logging: every unhandled API error is logged as a
 * single JSON line with route, status, and correlation id — greppable and
 * ready for a log aggregator. (Sentry, when configured, complements this.)
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, { event }) => {
    const statusCode = (error as { statusCode?: number })?.statusCode ?? 500
    // 4xx are expected client errors (validation, auth, rate limits) — only log server faults
    if (statusCode < 500) return

    console.error(JSON.stringify({
      level: 'error',
      time: new Date().toISOString(),
      method: event?.method,
      path: event?.path,
      statusCode,
      message: error instanceof Error ? error.message : String(error),
      correlationId: event?.context?.correlationId,
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5).join(' | ') : undefined,
    }))
  })
})

/**
 * Minimal error logger for config.js (avoids circular dependency with main logger)
 */

export function logError(message) {
  console.error('[Config]', message)
}

export function logErrors(messages) {
  messages.forEach((msg) => logError(msg))
}

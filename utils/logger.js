/**
 * Simple logger service for browser-side logging
 * Provides structured logging with prefixes.
 *
 * Severity gating: `error` and `warn` always log (we want real problems
 * visible in the production console). `info` and `debug` are diagnostic
 * noise — they are silenced in production and only print in dev.
 * `import.meta.dev` is replaced with a static boolean at build time, so
 * the dead branch is eliminated from the production bundle.
 */
const isDev = import.meta.dev

export const logger = {
  /**
   * Log error message — always logs (dev + production).
   * @param {string} prefix - Log prefix (e.g., '[EventsAPI]')
   * @param {string} message - Error message
   * @param {...any} args - Additional arguments
   */
  error(prefix, message, ...args) {
    console.error(`${prefix} ${message}`, ...args)
  },

  /**
   * Log warning message — always logs (dev + production).
   * @param {string} prefix - Log prefix
   * @param {string} message - Warning message
   * @param {...any} args - Additional arguments
   */
  warn(prefix, message, ...args) {
    console.warn(`${prefix} ${message}`, ...args)
  },

  /**
   * Log info message — dev only.
   * @param {string} prefix - Log prefix
   * @param {string} message - Info message
   * @param {...any} args - Additional arguments
   */
  info(prefix, message, ...args) {
    if (!isDev) return
    console.log(`${prefix} ${message}`, ...args)
  },

  /**
   * Log debug message — dev only.
   * @param {string} prefix - Log prefix
   * @param {string} message - Debug message
   * @param {...any} args - Additional arguments
   */
  debug(prefix, message, ...args) {
    if (!isDev) return
    console.log(`${prefix} [DEBUG] ${message}`, ...args)
  },
}

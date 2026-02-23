import { config } from '../config.js'

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 }
const currentLogLevel = config.logLevel === 'debug' ? LOG_LEVELS.DEBUG
  : config.logLevel === 'warn' ? LOG_LEVELS.WARN
  : config.logLevel === 'error' ? LOG_LEVELS.ERROR
  : LOG_LEVELS.INFO

function formatMessage(prefix, message) {
  return `${prefix} ${message}`
}

export const logger = {
  error(prefix, message, ...args) {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      const formatted = message instanceof Error ? formatMessage(prefix, message.message) : formatMessage(prefix, message)
      console.error(formatted, ...args)
      if (message instanceof Error && message.stack) {
        console.error(formatMessage(prefix, `Stack: ${message.stack}`))
      }
    }
  },
  warn(prefix, message, ...args) {
    if (currentLogLevel >= LOG_LEVELS.WARN) console.warn(formatMessage(prefix, message), ...args)
  },
  info(prefix, message, ...args) {
    if (currentLogLevel >= LOG_LEVELS.INFO) console.log(formatMessage(prefix, message), ...args)
  },
  debug(prefix, message, ...args) {
    if (currentLogLevel >= LOG_LEVELS.DEBUG) console.log(formatMessage(prefix, `[DEBUG] ${message}`), ...args)
  },
}

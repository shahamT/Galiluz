import { config } from './config.js'
import { startServer } from './server.js'
import { getStateInstance } from './services/greenApi.service.js'
import { logger } from './utils/logger.js'
import { LOG_PREFIXES } from './consts/index.js'

logger.info(LOG_PREFIXES.MAIN, '=== WhatsApp Gateway (Green API) ===')
logger.info(LOG_PREFIXES.MAIN, `Environment: ${config.nodeEnv}`)

const server = startServer(config.port)

// Best-effort boot diagnostic — never blocks startup. Surfaces whether the
// Green API instance is authorized so misconfig is obvious in the logs.
if (config.greenApi.idInstance && config.greenApi.apiToken) {
  getStateInstance()
    .then((s) => logger.info(LOG_PREFIXES.GREEN_API, `Instance state: ${s?.stateInstance || JSON.stringify(s)}`))
    .catch((err) => logger.warn(LOG_PREFIXES.GREEN_API, `Could not read instance state: ${err instanceof Error ? err.message : String(err)}`))
} else {
  logger.warn(LOG_PREFIXES.GREEN_API, 'Green API credentials not set — sends will fail until configured')
}

const shutdown = () => {
  logger.info(LOG_PREFIXES.SHUTDOWN, 'Shutting down...')
  server.close(() => process.exit(0))
  // Safety net if connections hang.
  setTimeout(() => process.exit(0), 5000).unref()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
process.on('uncaughtException', (err) => {
  logger.error(LOG_PREFIXES.FATAL, err)
  shutdown()
})
process.on('unhandledRejection', (reason) => {
  logger.error(LOG_PREFIXES.FATAL, `Unhandled rejection: ${reason}`)
})

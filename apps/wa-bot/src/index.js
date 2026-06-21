// v4
import { createServer } from 'http'
import { config } from './config.js'
import { logger } from './utils/logger.js'
import { LOG_PREFIXES } from './consts/index.js'
import { handleGet, handlePost, handleNotifyApprover, handleNotifyApproverEvent } from './routes/webhook.js'

function parseUrl(req) {
  try {
    return new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  } catch {
    return null
  }
}

const server = createServer((req, res) => {
  const url = parseUrl(req)
  if (!url) {
    res.writeHead(400)
    res.end()
    return
  }
  const pathname = url.pathname
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }
  if (pathname === '/webhook') {
    if (req.method === 'GET') {
      handleGet(req, res)
      return
    }
    if (req.method === 'POST') {
      handlePost(req, res)
      return
    }
  }
  // Internal (API_SECRET): web registration → send the approver Approve/Reject buttons.
  if (pathname === '/internal/notify-approver' && req.method === 'POST') {
    handleNotifyApprover(req, res)
    return
  }
  // Internal (API_SECRET): web event publish → send the approver the "new event" + delete button.
  if (pathname === '/internal/notify-approver-event' && req.method === 'POST') {
    handleNotifyApproverEvent(req, res)
    return
  }
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(config.port, () => {
  logger.info(LOG_PREFIXES.MAIN, `wa-bot listening on port ${config.port}`)
  logger.info(LOG_PREFIXES.MAIN, 'Webhook: GET/POST /webhook, Health: GET /health')
  if (config.isProduction) {
    logger.info(LOG_PREFIXES.MAIN, 'Production mode')
  } else {
    logger.info(LOG_PREFIXES.MAIN, `Publishers API: ${config.galiluzAppUrl} (dev MongoDB when Nuxt runs with root .env)`)
  }
})

const shutdown = () => {
  logger.info(LOG_PREFIXES.SHUTDOWN, 'Shutting down...')
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
process.on('uncaughtException', (err) => {
  logger.error(LOG_PREFIXES.FATAL, err)
  shutdown()
})
process.on('unhandledRejection', (reason, promise) => {
  logger.error(LOG_PREFIXES.FATAL, `Unhandled rejection: ${reason}`)
})

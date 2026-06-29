import { createServer } from 'node:http'
import { sendJson } from './utils/http.js'
import { checkApiSecret } from './utils/requireApiSecret.js'
import { handleHealth } from './routes/health.js'
import { handleOtp } from './routes/internal.js'
import { handleDiagnostics } from './routes/diagnostics.js'
import { handleGroups } from './routes/groups.js'
import { handleSendMessage } from './routes/sendMessage.js'
import { handleChatHistory } from './routes/chatHistory.js'
import { handleBroadcast } from './routes/broadcast.js'
import { handleLog } from './routes/log.js'
import { handleWebhook } from './routes/webhook.js'
import { logger } from './utils/logger.js'
import { LOG_PREFIXES } from './consts/index.js'

function parseUrl(req) {
  try {
    return new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  } catch {
    return null
  }
}

/** Build the HTTP server with the gateway's route table. */
export function createGatewayServer() {
  return createServer((req, res) => {
    const url = parseUrl(req)
    if (!url) return sendJson(res, 400, { error: 'bad request' })
    const { pathname } = url
    const method = req.method || 'GET'

    // Health (Render liveness)
    if (pathname === '/health' && method === 'GET') return handleHealth(req, res)

    // Internal action API — shared-secret gated
    if (pathname.startsWith('/internal/')) {
      if (!checkApiSecret(req)) return sendJson(res, 401, { error: 'unauthorized' })
      if (pathname === '/internal/otp' && method === 'POST') return handleOtp(req, res)
      if (pathname === '/internal/diagnostics' && method === 'GET') return handleDiagnostics(req, res)
      if (pathname === '/internal/groups' && method === 'GET') return handleGroups(req, res)
      if (pathname === '/internal/send-message' && method === 'POST') return handleSendMessage(req, res)
      if (pathname === '/internal/chat-history' && method === 'POST') return handleChatHistory(req, res)
      if (pathname === '/internal/broadcast' && method === 'POST') return handleBroadcast(req, res)
      if (pathname === '/internal/log' && method === 'POST') return handleLog(req, res)
      return sendJson(res, 404, { error: 'not found' })
    }

    // Green API incoming webhook (future)
    if (pathname === '/webhook/green-api' && method === 'POST') return handleWebhook(req, res)

    return sendJson(res, 404, { error: 'not found' })
  })
}

/** Start listening; returns the server instance. */
export function startServer(port) {
  const server = createGatewayServer()
  server.listen(port, () => {
    logger.info(LOG_PREFIXES.SERVER, `wa-gateway listening on port ${port}`)
    logger.info(LOG_PREFIXES.SERVER, 'Routes: GET /health, POST /internal/otp, GET /internal/diagnostics, GET /internal/groups, POST /internal/send-message, POST /internal/chat-history, POST /internal/broadcast, POST /internal/log, POST /webhook/green-api')
  })
  return server
}

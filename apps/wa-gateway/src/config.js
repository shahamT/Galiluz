import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env from the wa-gateway directory (its own, like the other apps).
dotenv.config({ path: join(__dirname, '../.env') })

/**
 * Loads + validates config. Fail-closed in production: the gateway refuses to
 * boot without the Green API credentials and the shared API secret.
 */
function loadConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development'
  const isProduction = nodeEnv === 'production'

  const cfg = {
    nodeEnv,
    isProduction,
    port: parseInt(process.env.PORT, 10) || 3030,
    logLevel: process.env.WA_LOG_LEVEL || 'info',
    // Shared secret with the Nuxt web app — gates /internal/* routes.
    apiSecret: process.env.API_SECRET || '',
    // Web app base URL — the crawler forwards messages to its internal API.
    webAppUrl: (process.env.WEB_APP_URL || process.env.GALILUZ_APP_URL || '').replace(/\/$/, ''),
    // Dedicated WhatsApp "log" group chatId (<id>@g.us) — operational notices (approved
    // publishers, published events, crawler drafts) are posted here. Unset → log sends no-op.
    logGroupChatId: (process.env.LOG_GROUP_CHAT_ID || '').trim(),
    greenApi: {
      idInstance: process.env.GREEN_API_ID_INSTANCE || '',
      apiToken: process.env.GREEN_API_API_TOKEN_INSTANCE || '',
      // Per-instance hosts may differ (e.g. https://7105.api.green-api.com); override via env.
      baseUrl: (process.env.GREEN_API_BASE_URL || 'https://api.green-api.com').replace(/\/$/, ''),
      mediaUrl: (process.env.GREEN_API_MEDIA_URL || 'https://media.green-api.com').replace(/\/$/, ''),
      // Optional: token Green API sends on incoming webhooks (Authorization: Bearer). Verified if set.
      webhookToken: process.env.GREEN_API_WEBHOOK_TOKEN || '',
    },
    // Broadcast pacing — Green API drives a regular WhatsApp number, so bulk sends must be
    // throttled to avoid a ban. Sends are sequential with a randomized delay between each,
    // plus a longer pause every batch. All optional; defaults are deliberately conservative.
    broadcast: {
      minDelayMs: parseInt(process.env.BROADCAST_MIN_DELAY_MS, 10) || 8000,
      maxDelayMs: parseInt(process.env.BROADCAST_MAX_DELAY_MS, 10) || 20000,
      batchSize: parseInt(process.env.BROADCAST_BATCH_SIZE, 10) || 25,
      batchPauseMs: parseInt(process.env.BROADCAST_BATCH_PAUSE_MS, 10) || 60000,
    },
  }

  if (isProduction) {
    const missing = []
    if (!cfg.apiSecret || cfg.apiSecret.length < 16) missing.push('API_SECRET (min 16 chars)')
    if (!cfg.greenApi.idInstance) missing.push('GREEN_API_ID_INSTANCE')
    if (!cfg.greenApi.apiToken) missing.push('GREEN_API_API_TOKEN_INSTANCE')
    if (missing.length) {
      console.error(`[Config] FATAL: missing required env in production: ${missing.join(', ')}`)
      process.exit(1)
    }
  }

  return cfg
}

export const config = loadConfig()

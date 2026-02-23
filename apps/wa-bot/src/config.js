import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { logError, logErrors } from './utils/errorLogger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '../.env') })

function loadConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development'
  const isProduction = nodeEnv === 'production'

  const port = parseInt(process.env.PORT, 10) || 3001
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || ''
  const accessToken = process.env.WA_CLOUD_ACCESS_TOKEN || ''
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID || ''

  if (isProduction) {
    const missing = []
    if (!verifyToken) missing.push('WEBHOOK_VERIFY_TOKEN')
    if (!accessToken) missing.push('WA_CLOUD_ACCESS_TOKEN')
    if (!phoneNumberId) missing.push('WA_PHONE_NUMBER_ID')
    if (missing.length > 0) {
      logError('Missing required environment variables:')
      logErrors(missing.map((v) => `  - ${v}`))
      process.exit(1)
    }
  }

  return {
    nodeEnv,
    isProduction,
    port,
    webhook: {
      verifyToken,
    },
    whatsapp: {
      accessToken,
      phoneNumberId,
    },
    galiluzAppUrl: process.env.GALILUZ_APP_URL || 'https://galiluz.co.il',
    galiluzAppApiKey: process.env.GALILUZ_APP_API_KEY || process.env.API_SECRET || '',
    publishersApproverWaNumber: process.env.PUBLISHERS_APPROVER_WA_NUMBER || '',
    logLevel: process.env.LOG_LEVEL || 'info',
  }
}

/**
 * Normalize phone/waId to digits only for comparison.
 * @param {string} value
 * @returns {string}
 */
export function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '')
}

export const config = loadConfig()

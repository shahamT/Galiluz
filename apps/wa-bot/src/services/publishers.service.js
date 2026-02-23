import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

const GALILUZ_BASE_URL = 'https://galiluz.co.il'

/**
 * Check publisher status by WhatsApp user id.
 * @param {string} waId - WhatsApp user id (msg.from)
 * @returns {Promise<{ status: 'not_found' | 'pending' | 'approved' }>}
 */
export async function checkPublisher(waId) {
  const baseUrl = config.galiluzAppUrl.replace(/\/$/, '') || GALILUZ_BASE_URL
  const url = `${baseUrl}/api/publishers/check?waId=${encodeURIComponent(String(waId))}`
  const headers = { Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey

  try {
    const res = await fetch(url, { headers })
    if (!res.ok) {
      logger.error(LOG_PREFIXES.CLOUD_API, 'Publishers check failed', res.status)
      return { status: 'not_found' }
    }
    const data = await res.json()
    const status = data.status === 'approved' ? 'approved' : data.status === 'pending' ? 'pending' : 'not_found'
    return { status }
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Publishers check error', err)
    return { status: 'not_found' }
  }
}

/**
 * Register a new publisher (pending).
 * @param {{ waId: string, profileName?: string, fullName: string, publishingAs: string, eventTypesDescription: string }} payload
 * @returns {Promise<{ success: boolean }>}
 */
export async function registerPublisher(payload) {
  const baseUrl = config.galiluzAppUrl.replace(/\/$/, '') || GALILUZ_BASE_URL
  const url = `${baseUrl}/api/publishers/register`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const errBody = await res.text()
      logger.error(LOG_PREFIXES.CLOUD_API, 'Publishers register failed', res.status, errBody)
      return { success: false }
    }
    return { success: true }
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Publishers register error', err)
    return { success: false }
  }
}

import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

const GALILUZ_BASE_URL = 'https://galiluz.co.il'

/**
 * Format event only (no DB insert). Same body as create. Used for confirm-step preview.
 * @param {{ rawEvent: object, media: Array<{ cloudinaryURL: string, cloudinaryData: object, isMain?: boolean }>, mainCategory: string, categories: string[] }} body
 * @returns {Promise<{ success: boolean, formattedEvent?: object }>}
 */
export async function formatEvent(body) {
  const baseUrl = config.galiluzAppUrl.replace(/\/$/, '') || GALILUZ_BASE_URL
  const url = `${baseUrl}/api/events/format`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const errBody = await res.text()
      logger.error(LOG_PREFIXES.CLOUD_API, 'Events format failed', res.status, errBody)
      return { success: false, reason: `HTTP ${res.status}: ${errBody.slice(0, 200)}` }
    }
    const data = await res.json()
    if (data.error || data.formattedEvent == null) {
      logger.info(LOG_PREFIXES.CLOUD_API, 'Events format returned no event', data.error ? 'error: true' : 'formattedEvent null')
      return { success: false, reason: data.error ? 'server error' : 'no formattedEvent' }
    }
    return { success: true, formattedEvent: data.formattedEvent }
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Events format error', err)
    return { success: false, reason: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Create event via Nuxt API (inserts into events collection). rawEvent must use raw* keys (rawTitle, rawCity, etc.).
 * When formattedEvent is provided (after user confirmed preview), server skips format and inserts it.
 * @param {{ rawEvent: object, media: Array<{ cloudinaryURL: string, cloudinaryData: object, isMain?: boolean }>, mainCategory: string, categories: string[], formattedEvent?: object }} body
 * @returns {Promise<{ success: boolean, id?: string }>}
 */
export async function createEvent(body) {
  const baseUrl = config.galiluzAppUrl.replace(/\/$/, '') || GALILUZ_BASE_URL
  const url = `${baseUrl}/api/events/create`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const errBody = await res.text()
      logger.error(LOG_PREFIXES.CLOUD_API, 'Events create failed', res.status, errBody)
      return { success: false }
    }
    const data = await res.json()
    return { success: true, id: data.id }
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Events create error', err)
    return { success: false }
  }
}

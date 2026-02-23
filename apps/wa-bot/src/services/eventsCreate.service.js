import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

const GALILUZ_BASE_URL = 'https://galiluz.co.il'

/**
 * Create event via Nuxt API (inserts into events collection).
 * @param {{ rawEvent: object, media: Array<{ cloudinaryURL: string, cloudinaryData: object, isMain?: boolean }>, mainCategory: string, categories: string[] }} body
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

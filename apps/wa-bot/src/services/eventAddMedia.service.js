import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

const GALILUZ_BASE_URL = 'https://galiluz.co.il'

/**
 * Upload media buffer to Nuxt upload-media API (which uploads to Cloudinary).
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @param {string} filename
 * @returns {Promise<{ url: string, secure_url: string, public_id: string, [key: string]: unknown }|null>}
 */
export async function uploadMediaToApp(buffer, mimetype, filename) {
  const baseUrl = config.galiluzAppUrl.replace(/\/$/, '') || GALILUZ_BASE_URL
  const url = `${baseUrl}/api/internal/upload-media`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        file: buffer.toString('base64'),
        mimetype,
        filename: filename || 'file',
      }),
    })
    if (!res.ok) {
      const errBody = await res.text()
      logger.error(LOG_PREFIXES.CLOUD_API, 'Upload media failed', res.status, errBody)
      return null
    }
    const data = await res.json()
    return data
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Upload media error', err)
    return null
  }
}

/**
 * Delete media from Cloudinary via Nuxt delete-media API.
 * @param {Array<{ publicId: string, resourceType?: 'image'|'video'|'raw' }>} items
 * @returns {Promise<boolean>}
 */
export async function deleteMediaOnApp(items) {
  if (!Array.isArray(items) || items.length === 0) return true
  const baseUrl = config.galiluzAppUrl.replace(/\/$/, '') || GALILUZ_BASE_URL
  const url = `${baseUrl}/api/internal/delete-media`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ items }),
    })
    if (!res.ok) {
      const errBody = await res.text()
      logger.error(LOG_PREFIXES.CLOUD_API, 'Delete media failed', res.status, errBody)
      return false
    }
    const data = await res.json()
    return data?.success === true
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Delete media error', err)
    return false
  }
}

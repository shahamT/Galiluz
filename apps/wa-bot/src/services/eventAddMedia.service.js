import { config } from '../config.js'
import { LOG_PREFIXES } from '../consts/index.js'
import { logger } from '../utils/logger.js'

const FETCH_IMAGE_TIMEOUT_MS = 10_000
const USER_AGENT = 'Mozilla/5.0 (compatible; GaliluzBot/1.0)'

/**
 * Fetch image from URL and upload to Cloudinary via Nuxt API.
 * @param {string} imageUrl - Public image URL (https)
 * @param {boolean} [isMain] - Whether this is the main/primary image
 * @returns {Promise<{ cloudinaryURL: string, cloudinaryData: object, isMain: boolean }|null>}
 */
export async function uploadMediaFromUrl(imageUrl, isMain = false) {
  if (!imageUrl || typeof imageUrl !== 'string' || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
    return null
  }
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_IMAGE_TIMEOUT_MS)
  try {
    const res = await fetch(imageUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'image/*' },
      redirect: 'follow',
    })
    clearTimeout(timeoutId)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    let mimetype = 'image/jpeg'
    if (contentType.includes('png')) mimetype = 'image/png'
    else if (contentType.includes('webp')) mimetype = 'image/webp'
    else if (contentType.includes('gif')) mimetype = 'image/gif'
    else if (contentType.includes('jpeg') || contentType.includes('jpg')) mimetype = 'image/jpeg'
    const ext = mimetype.split('/')[1] || 'jpg'
    const filename = `event-link-${Date.now()}.${ext}`
    const data = await uploadMediaToApp(buffer, mimetype, filename)
    if (!data?.secure_url) return null
    return {
      cloudinaryURL: data.secure_url,
      cloudinaryData: data,
      isMain,
    }
  } catch (err) {
    clearTimeout(timeoutId)
    logger.warn(LOG_PREFIXES.CLOUD_API, 'uploadMediaFromUrl failed', imageUrl.slice(0, 60), err?.message)
    return null
  }
}

/**
 * Upload media buffer to Nuxt upload-media API (which uploads to Cloudinary).
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @param {string} filename
 * @returns {Promise<{ url: string, secure_url: string, public_id: string, [key: string]: unknown }|null>}
 */
export async function uploadMediaToApp(buffer, mimetype, filename) {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
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
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
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

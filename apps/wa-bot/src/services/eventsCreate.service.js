import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

const GALILUZ_BASE_URL = 'https://galiluz.co.il'

/**
 * Create draft in MongoDB (raw data only). Record exists before format. Same body as create.
 * @param {{ rawEvent: object, media: Array, mainCategory: string, categories: string[] }} body
 * @returns {Promise<{ success: boolean, id?: string }>}
 */
export async function createDraft(body) {
  const baseUrl = config.galiluzAppUrl.replace(/\/$/, '') || GALILUZ_BASE_URL
  const url = `${baseUrl}/api/events/draft`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) {
      const errBody = await res.text()
      logger.error(LOG_PREFIXES.CLOUD_API, 'Events draft failed', res.status, errBody)
      return { success: false }
    }
    const data = await res.json()
    return { success: true, id: data.id }
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Events draft error', err)
    return { success: false }
  }
}

/**
 * Process draft: run format and update the draft doc. Returns formattedEvent or fails with reason.
 * @param {string} draftId - id from createDraft
 * @returns {Promise<{ success: boolean, formattedEvent?: object, reason?: string }>}
 */
export async function processDraft(draftId) {
  const baseUrl = config.galiluzAppUrl.replace(/\/$/, '') || GALILUZ_BASE_URL
  const url = `${baseUrl}/api/events/${encodeURIComponent(draftId)}/process`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey
  try {
    const res = await fetch(url, { method: 'POST', headers })
    if (!res.ok) {
      const errBody = await res.text()
      let reason = `HTTP ${res.status}`
      if (errBody.length > 0) {
        try {
          const data = JSON.parse(errBody)
          if (typeof data.message === 'string' && data.message.trim()) {
            reason = data.message.trim()
          } else if (typeof data.errorMessage === 'string' && data.errorMessage.trim()) {
            reason = data.errorMessage.trim()
          } else {
            reason = errBody.slice(0, 300)
          }
        } catch {
          reason = errBody.slice(0, 300)
        }
      }
      logger.error(LOG_PREFIXES.CLOUD_API, 'Events process failed', res.status, reason)
      return { success: false, reason }
    }
    const data = await res.json()
    if (!data.formattedEvent) return { success: false, reason: 'no formattedEvent' }
    return { success: true, formattedEvent: data.formattedEvent }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    logger.error(LOG_PREFIXES.CLOUD_API, 'Events process error', err)
    return { success: false, reason }
  }
}

/**
 * Activate a processed draft (set isActive: true). Call when user confirms in wa-bot.
 * @param {string} draftId
 * @returns {Promise<{ success: boolean }>}
 */
export async function activateEvent(draftId) {
  const baseUrl = config.galiluzAppUrl.replace(/\/$/, '') || GALILUZ_BASE_URL
  const url = `${baseUrl}/api/events/${encodeURIComponent(draftId)}/activate`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey
  try {
    const res = await fetch(url, { method: 'POST', headers })
    if (!res.ok) {
      const errBody = await res.text()
      logger.error(LOG_PREFIXES.CLOUD_API, 'Events activate failed', res.status, errBody)
      return { success: false }
    }
    return { success: true }
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Events activate error', err)
    return { success: false }
  }
}

/**
 * Format event only (no DB insert). Same body as create. Used when not using draft flow.
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
      const reason = data.errorMessage && typeof data.errorMessage === 'string'
        ? data.errorMessage
        : data.error
          ? 'server error'
          : 'no formattedEvent'
      logger.info(LOG_PREFIXES.CLOUD_API, 'Events format returned no event', { reason, serverError: data.errorMessage })
      return { success: false, reason }
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

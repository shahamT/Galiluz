import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

/**
 * PATCH draft/event: partial updates (edit flow). Used for both drafts and active events (update flow).
 * @param {string} draftId - MongoDB draft id
 * @param {Record<string, unknown>} updates - Partial event fields (e.g. { title, fullDescription, shortDescription } or { mainCategory, categories })
 * @returns {Promise<{ success: boolean, event?: object, reason?: string }>} event = updated formatted event for preview refresh
 */
export async function patchDraft(draftId, updates) {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  const url = `${baseUrl}/api/events/${encodeURIComponent(draftId)}/patch`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(updates) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      logger.error(LOG_PREFIXES.CLOUD_API, 'Events patch failed', res.status, data?.message || data)
      return { success: false, reason: data?.message || res.statusText }
    }
    return { success: true, event: data.event }
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Events patch error', err)
    return { success: false, reason: err?.message || 'patch_error' }
  }
}

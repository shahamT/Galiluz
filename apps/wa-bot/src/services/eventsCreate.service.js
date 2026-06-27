import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

/**
 * The only event action the bot still performs: the approver deleting an event from the
 * "new event published" notification. All event creation/editing happens on the web portal.
 *
 * Delete an event (approver-initiated, soft delete + cascade).
 * @param {string} eventId - MongoDB event id
 * @returns {Promise<{ success: boolean }>}
 */
export async function deleteEvent(eventId) {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  const url = `${baseUrl}/api/events/${encodeURIComponent(String(eventId))}/delete`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ deletionType: 'user_deleted' }),
    })
    if (!res.ok) {
      const errBody = await res.text()
      logger.error(LOG_PREFIXES.CLOUD_API, 'Events delete failed', res.status, errBody)
      return { success: false }
    }
    return { success: true }
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Events delete error', err)
    return { success: false }
  }
}

import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

/**
 * The only event action the bot still performs: the approver deleting an event from the
 * "new event published" notification. All event creation/editing happens on the web portal.
 *
 * Delete an event (approver-initiated, atomic first-wins soft delete). Pass the acting approver's
 * waId so the web records who deleted it (and tells a late approver it was already removed).
 * @param {string} eventId - MongoDB event id
 * @param {string} [actorWaId] - the approver who clicked
 * @param {string} [reason] - optional message to the publisher; the web sends it via the wa-gateway
 * @returns {Promise<{ applied: boolean, by?: string|null, eventTitle?: string, publisherPhone?: string, actorName?: string, error?: string }>}
 */
export async function deleteEvent(eventId, actorWaId, reason) {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  const url = `${baseUrl}/api/events/${encodeURIComponent(String(eventId))}/delete`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ deletionType: 'user_deleted', actorWaId, reason: reason || undefined }),
    })
    if (!res.ok) {
      const errBody = await res.text()
      logger.error(LOG_PREFIXES.CLOUD_API, 'Events delete failed', res.status, errBody)
      return { applied: false, error: 'http' }
    }
    return await res.json()
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Events delete error', err)
    return { applied: false, error: 'network' }
  }
}

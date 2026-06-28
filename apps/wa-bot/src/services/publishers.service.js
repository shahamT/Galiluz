import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

/**
 * Publisher lifecycle actions the bot still performs — both driven by the approver flow
 * (Approve/Reject buttons). Everything else about publishers (registration, login, event
 * management) now lives on the web portal; the bot only directs publishers there.
 */

/**
 * Approve a publisher (atomic first-wins on the web). Pass the acting approver's waId so the web can
 * record who approved and tell a late approver it was already handled.
 * @param {string} waId - publisher WhatsApp id
 * @param {string} [actorWaId] - the approver who clicked
 * @returns {Promise<{ applied: boolean, by?: string|null, resolvedStatus?: string, publisherName?: string, actorName?: string, error?: string }>}
 */
export async function approvePublisher(waId, actorWaId) {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  const url = `${baseUrl}/api/publishers/approve`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey

  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ waId, actorWaId }) })
    if (!res.ok) {
      logger.error(LOG_PREFIXES.CLOUD_API, 'Publishers approve failed', res.status)
      return { applied: false, error: 'http' }
    }
    return await res.json()
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Publishers approve error', err)
    return { applied: false, error: 'network' }
  }
}

/**
 * Reject a publisher (atomic first-wins). Reason is only for the message to the publisher.
 * @param {string} waId - publisher WhatsApp id
 * @param {string} [actorWaId] - the approver who clicked
 * @param {string} [reason] - optional rejection reason
 * @returns {Promise<{ applied: boolean, by?: string|null, resolvedStatus?: string, publisherName?: string, actorName?: string, error?: string }>}
 */
export async function rejectPublisher(waId, actorWaId, reason) {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  const url = `${baseUrl}/api/publishers/reject`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey

  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ waId, actorWaId, reason: reason || undefined }) })
    if (!res.ok) {
      logger.error(LOG_PREFIXES.CLOUD_API, 'Publishers reject failed', res.status)
      return { applied: false, error: 'http' }
    }
    return await res.json()
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Publishers reject error', err)
    return { applied: false, error: 'network' }
  }
}

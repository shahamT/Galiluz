import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

/**
 * Publisher lifecycle actions the bot still performs — both driven by the approver flow
 * (Approve/Reject buttons). Everything else about publishers (registration, login, event
 * management) now lives on the web portal; the bot only directs publishers there.
 */

/**
 * Approve a publisher (set status to approved).
 * @param {string} waId - WhatsApp user id
 * @returns {Promise<{ success: boolean }>}
 */
export async function approvePublisher(waId) {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  const url = `${baseUrl}/api/publishers/approve`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ waId }),
    })
    if (!res.ok) {
      logger.error(LOG_PREFIXES.CLOUD_API, 'Publishers approve failed', res.status)
      return { success: false }
    }
    return { success: true }
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Publishers approve error', err)
    return { success: false }
  }
}

/**
 * Reject (delete) a publisher. Reason is used only for the message to the publisher.
 * @param {string} waId - WhatsApp user id
 * @param {string} [reason] - Optional rejection reason
 * @returns {Promise<{ success: boolean }>}
 */
export async function rejectPublisher(waId, reason) {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  const url = `${baseUrl}/api/publishers/reject`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ waId, reason: reason || undefined }),
    })
    if (!res.ok) {
      logger.error(LOG_PREFIXES.CLOUD_API, 'Publishers reject failed', res.status)
      return { success: false }
    }
    return { success: true }
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Publishers reject error', err)
    return { success: false }
  }
}

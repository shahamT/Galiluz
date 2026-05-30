import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

/**
 * Check publisher status by WhatsApp user id.
 * @param {string} waId - WhatsApp user id (msg.from)
 * @returns {Promise<{ status: 'not_found' | 'pending' | 'approved', connectionError?: boolean }>}
 */
export async function checkPublisher(waId) {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  const url = `${baseUrl}/api/publishers/check?waId=${encodeURIComponent(String(waId))}`
  const headers = { Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey

  try {
    const res = await fetch(url, { headers })
    if (!res.ok) {
      logger.error(LOG_PREFIXES.CLOUD_API, 'Publishers check failed', res.status)
      return { status: 'not_found' }
    }
    const data = await res.json()
    const status = data.status === 'approved' ? 'approved' : data.status === 'pending' ? 'pending' : 'not_found'
    const fullName = typeof data.fullName === 'string' ? data.fullName : ''
    const publishingAs = typeof data.publishingAs === 'string' ? data.publishingAs : ''
    return { status, fullName, publishingAs }
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Publishers check error', err)
    return { status: 'not_found', connectionError: true }
  }
}

/**
 * Register a new publisher (pending).
 * @param {{ waId: string, profileName?: string, fullName: string, publishingAs: string, eventTypesDescription: string }} payload
 * @returns {Promise<{ success: boolean }>}
 */
export async function registerPublisher(payload) {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  const url = `${baseUrl}/api/publishers/register`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const errBody = await res.text()
      logger.error(LOG_PREFIXES.CLOUD_API, 'Publishers register failed', res.status, errBody)
      return { success: false }
    }
    return { success: true }
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Publishers register error', err)
    return { success: false }
  }
}

/**
 * Create a ghost publisher record for a phone that has never self-registered.
 * Idempotent — safe to call even if a record already exists (existing records are not modified).
 * @param {string} waId - WhatsApp user id (target phone)
 */
export async function createGhostPublisher(waId) {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  const url = `${baseUrl}/api/publishers/ghost`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey
  try {
    await fetch(url, { method: 'POST', headers, body: JSON.stringify({ waId }) })
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'createGhostPublisher error', err)
  }
}

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

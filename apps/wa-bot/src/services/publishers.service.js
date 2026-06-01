import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

/** In-memory set of manager waIds — populated on startup via loadManagers() */
let managersSet = new Set()

/**
 * Load manager waIds from the server API into the in-memory set.
 * Called once on bot startup; safe to call again to refresh.
 */
export async function loadManagers() {
  try {
    const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
    const headers = { Accept: 'application/json' }
    if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey
    const res = await fetch(`${baseUrl}/api/publishers/managers`, { headers })
    if (!res.ok) {
      logger.error(LOG_PREFIXES.CLOUD_API, 'loadManagers failed', res.status)
      return
    }
    const waIds = await res.json()
    managersSet = new Set(Array.isArray(waIds) ? waIds.map(String) : [])
    logger.info(LOG_PREFIXES.CLOUD_API, `loadManagers: loaded ${managersSet.size} manager(s)`)
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'loadManagers error', err)
  }
}

/**
 * Returns true if the given waId belongs to a manager (synchronous, uses in-memory set).
 */
export function isManagerWaId(waId) {
  return managersSet.has(String(waId))
}

/**
 * Check publisher status by WhatsApp user id.
 * @param {string} waId - WhatsApp user id (msg.from)
 * @returns {Promise<{ status: 'not_found' | 'pending' | 'approved', fullName: string, publishingAs: string, type: string, connectionError?: boolean }>}
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
    const type = data.type === 'manager' ? 'manager' : 'publisher'
    return { status, fullName, publishingAs, type }
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

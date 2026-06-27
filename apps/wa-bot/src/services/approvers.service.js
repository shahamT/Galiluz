import { config, normalizePhone } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

/**
 * Cached approver list, fetched from the web (`GET /api/internal/approvers`). Approvers are
 * configured in the admin portal (publishers picked as approvers); the web resolves them to
 * { waId, name } and falls back to the legacy env approver when none are configured.
 *
 * The bot keeps a small in-memory cache (refreshed on boot + every few minutes) so message
 * processing reads it synchronously. If the web is unreachable, a stale cache (or the bot's own env
 * fallback) keeps the single legacy approver working.
 */
const REFRESH_MS = 2 * 60 * 1000
let cache = [] // [{ waId, name }]

async function fetchApprovers() {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  const headers = { Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey
  try {
    const res = await fetch(`${baseUrl}/api/internal/approvers`, { headers })
    if (!res.ok) {
      logger.error(LOG_PREFIXES.WEBHOOK, 'Fetch approvers failed', res.status)
      return null
    }
    const data = await res.json()
    const list = Array.isArray(data?.approvers) ? data.approvers : []
    return list.map((a) => ({ waId: normalizePhone(a.waId), name: String(a.name || '') })).filter((a) => a.waId)
  } catch (err) {
    logger.error(LOG_PREFIXES.WEBHOOK, 'Fetch approvers error', err instanceof Error ? err.message : String(err))
    return null
  }
}

function envFallback() {
  const wa = config.publishersApproverWaNumber ? normalizePhone(config.publishersApproverWaNumber) : ''
  return wa ? [{ waId: wa, name: 'מאשר' }] : []
}

/** Refresh the cache from the web (keeps the stale cache on failure). */
export async function refreshApprovers() {
  const list = await fetchApprovers()
  if (list) cache = list
  return cache
}

/** Current approvers (cache, or the env fallback when the cache is empty). Synchronous. */
export function getAllApprovers() {
  return cache.length ? cache : envFallback()
}

export function isApprover(waId) {
  const norm = normalizePhone(waId)
  return getAllApprovers().some((a) => a.waId === norm)
}

export function getApproverName(waId) {
  const norm = normalizePhone(waId)
  return getAllApprovers().find((a) => a.waId === norm)?.name || ''
}

/** Boot warm-up + periodic refresh. Call once at startup. */
export function startApproverRefresh() {
  refreshApprovers()
  const t = setInterval(refreshApprovers, REFRESH_MS)
  if (typeof t.unref === 'function') t.unref()
}

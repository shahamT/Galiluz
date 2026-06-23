import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

/**
 * Crawler service: keeps a small in-memory cache of which groups to watch
 * (synced from the web app) and forwards qualifying group messages to the web
 * ingest pipeline. The web app is the authority — it re-validates enabled /
 * group / publisher / dedup; this cache only trims forwarding noise.
 */
let cache = { enabled: false, groupChatIds: new Set(), synced: false }

export function getWatchedCache() {
  return cache
}

export async function refreshWatchedGroups() {
  if (!config.webAppUrl || !config.apiSecret) return
  try {
    const res = await fetch(`${config.webAppUrl}/api/internal/crawler/watched-groups`, {
      headers: { 'x-api-key': config.apiSecret },
    })
    if (!res.ok) {
      logger.warn(LOG_PREFIXES.CRAWLER, `watched-groups sync failed: ${res.status}`)
      return
    }
    const data = await res.json()
    const nextEnabled = data?.enabled === true
    const nextIds = new Set(Array.isArray(data?.groupChatIds) ? data.groupChatIds : [])
    // Log only when the watched config actually changes (first sync, enabled flip, or a
    // group added/removed) — the 2-minute poll otherwise stays silent to avoid log noise.
    const changed =
      !cache.synced ||
      cache.enabled !== nextEnabled ||
      cache.groupChatIds.size !== nextIds.size ||
      [...nextIds].some((id) => !cache.groupChatIds.has(id))
    cache = { enabled: nextEnabled, groupChatIds: nextIds, synced: true }
    if (changed) {
      logger.info(LOG_PREFIXES.CRAWLER, `watched groups synced: enabled=${cache.enabled}, ${cache.groupChatIds.size} group(s)`)
    }
  } catch (err) {
    logger.warn(LOG_PREFIXES.CRAWLER, `watched-groups sync error: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** Start the periodic sync (boot + every 2 minutes). */
export function startWatchedGroupSync() {
  refreshWatchedGroups()
  const t = setInterval(refreshWatchedGroups, 2 * 60 * 1000)
  if (typeof t.unref === 'function') t.unref()
}

/** Forward a parsed group message to the web ingest pipeline (fire-and-forget). */
export async function forwardToIngest(payload) {
  if (!config.webAppUrl || !config.apiSecret) {
    logger.error(LOG_PREFIXES.CRAWLER, 'cannot forward — WEB_APP_URL/API_SECRET not configured')
    return
  }
  try {
    const res = await fetch(`${config.webAppUrl}/api/internal/crawler/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiSecret },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      logger.warn(LOG_PREFIXES.CRAWLER, `ingest → ${res.status}: ${JSON.stringify(data)}`)
    } else if (data?.processed) {
      logger.info(LOG_PREFIXES.CRAWLER, `🆕 draft created: "${data.title || '?'}" — ${data.publisherName || ''} (${data.waId || ''})`)
    } else {
      // duplicate / publisher_not_eligible / etc. — routine per-message skips, demoted to debug.
      logger.debug(LOG_PREFIXES.CRAWLER, `ingest skip: ${data?.reason || 'unknown'}`)
    }
  } catch (err) {
    logger.error(LOG_PREFIXES.CRAWLER, `ingest forward error: ${err instanceof Error ? err.message : String(err)}`)
  }
}

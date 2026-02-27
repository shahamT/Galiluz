import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'
import { formatPublisherEvent } from 'event-format'

/** TTL for in-memory categories cache (ms). After this, next getCategories() refetches. */
const CATEGORIES_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

let categoriesCache = null
let categoriesCacheExpiry = 0

/**
 * Fetch categories from Nuxt (GET /api/categories). Cached in memory with TTL.
 * @returns {Promise<Array<{id: string, label: string}>>}
 */
export async function getCategories() {
  const now = Date.now()
  if (Array.isArray(categoriesCache) && categoriesCache.length > 0 && now < categoriesCacheExpiry) {
    return categoriesCache
  }
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  const url = `${baseUrl}/api/categories`
  const headers = { Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey
  try {
    const res = await fetch(url, { method: 'GET', headers })
    if (!res.ok) {
      logger.error(LOG_PREFIXES.CLOUD_API, 'Categories fetch failed', res.status)
      categoriesCache = null
      categoriesCacheExpiry = 0
      return []
    }
    const data = await res.json()
    const list = Array.isArray(data)
      ? data
      : data && typeof data === 'object' && data.categories
        ? data.categories
        : data && typeof data === 'object' && !Array.isArray(data)
          ? Object.entries(data).map(([id, c]) => ({ id, label: (c && typeof c === 'object' && c.label) ? c.label : id }))
          : []
    const normalized = list
      .filter((c) => c && typeof c.id === 'string')
      .map((c) => ({ id: c.id, label: typeof c.label === 'string' ? c.label : c.id }))
    if (normalized.length > 0) {
      categoriesCache = normalized
      categoriesCacheExpiry = now + CATEGORIES_CACHE_TTL_MS
    } else {
      categoriesCache = null
      categoriesCacheExpiry = 0
    }
    return normalized
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Categories fetch error', err)
    categoriesCache = null
    categoriesCacheExpiry = 0
    return []
  }
}

/**
 * Create draft in MongoDB (raw data only). Record exists before format. Same body as create.
 * @param {{ rawEvent: object, media: Array, mainCategory: string, categories: string[] }} body
 * @returns {Promise<{ success: boolean, id?: string }>}
 */
export async function createDraft(body) {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
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
 * Process draft: format locally (OpenAI) then POST formattedEvent to Nuxt to update draft.
 * When body.formattedEvent is provided (free-lang flow), skip formatPublisherEvent and POST directly.
 * @param {string} draftId - id from createDraft
 * @param {{ rawEvent?: object, formattedEvent?: object, media?: Array, mainCategory?: string, categories?: string[] }} body
 * @returns {Promise<{ success: boolean, formattedEvent?: object, flags?: Array<{ fieldKey: string, reason: string }>, reason?: string }>}
 */
export async function processDraft(draftId, body) {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  const correlationId = `${Date.now().toString(36)}-${draftId.slice(-4)}`
  const rawEvent = body?.rawEvent
  const media = Array.isArray(body?.media) ? body.media : []
  let formattedEvent = body?.formattedEvent && typeof body.formattedEvent === 'object' ? body.formattedEvent : null

  if (formattedEvent) {
    logger.info(LOG_PREFIXES.CLOUD_API, 'processDraft: using pre-formatted event, bypassing formatPublisherEvent', { draftId: draftId?.slice(-8) })
    const eventWithMedia = { ...formattedEvent, media: media.length > 0 ? media : (formattedEvent.media ?? []) }
    const url = `${baseUrl}/api/events/${encodeURIComponent(draftId)}/process`
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
    if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ formattedEvent: eventWithMedia }),
      })
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
      return { success: true, formattedEvent: data.formattedEvent, flags: [] }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      logger.error(LOG_PREFIXES.CLOUD_API, 'Events process error', err)
      return { success: false, reason }
    }
  }

  logger.info(LOG_PREFIXES.CLOUD_API, 'processDraft: no formattedEvent, calling formatPublisherEvent', { draftId: draftId?.slice(-8) })
  const mainCategory = typeof body?.mainCategory === 'string' ? body.mainCategory.trim() : ''
  const categories = Array.isArray(body?.categories) ? body.categories.filter((c) => typeof c === 'string') : []
  const rawEventWithAll = {
    ...(rawEvent && typeof rawEvent === 'object' ? rawEvent : {}),
    rawMainCategory: mainCategory,
    rawCategories: categories,
    rawMedia: media,
  }

  const categoriesList = await getCategories()
  if (!categoriesList.length) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'No categories for format')
    return { success: false, reason: 'empty_categories_list' }
  }

  const formatResult = await formatPublisherEvent(rawEventWithAll, categoriesList, {
    correlationId,
    openaiApiKey: config.openaiApiKey,
    openaiModel: config.openaiModel,
  })
  if (!formatResult.formattedEvent) {
    return { success: false, reason: formatResult.errorReason || 'format failed' }
  }

  const flags = Array.isArray(formatResult.flags)
    ? formatResult.flags.filter((f) => f && typeof f.fieldKey === 'string' && typeof f.reason === 'string').map((f) => ({ fieldKey: f.fieldKey, reason: f.reason }))
    : []
  if (flags.length > 0) {
    logger.info(LOG_PREFIXES.CLOUD_API, 'processDraft: format returned flags', {
      draftId,
      rawOccurrences: rawEvent?.rawOccurrences ?? '(none)',
      rawOccurrencesLength: typeof rawEvent?.rawOccurrences === 'string' ? rawEvent.rawOccurrences.length : 0,
      flags: flags.map((f) => ({ fieldKey: f.fieldKey, reason: f.reason })),
    })
    return { success: true, formattedEvent: formatResult.formattedEvent, flags }
  }

  const url = `${baseUrl}/api/events/${encodeURIComponent(draftId)}/process`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ formattedEvent: formatResult.formattedEvent }),
    })
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
    return { success: true, formattedEvent: data.formattedEvent, flags: [] }
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
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
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
 * Create event via Nuxt API (inserts into events collection).
 * Body must include formattedEvent; server validates and inserts only.
 * @param {{ rawEvent: object, media: Array, mainCategory: string, categories: string[], formattedEvent: object }} body
 * @returns {Promise<{ success: boolean, id?: string, reason?: string }>}
 */
export async function createEvent(body) {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
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
      logger.error(LOG_PREFIXES.CLOUD_API, 'Events create failed', res.status, reason)
      return { success: false, reason }
    }
    const data = await res.json()
    return { success: true, id: data.id }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    logger.error(LOG_PREFIXES.CLOUD_API, 'Events create error', err)
    return { success: false, reason }
  }
}

/**
 * Fetch events by publisher (waId) with at least one occurrence today or in the future (Israel).
 * Used for update/delete event selection in wa-bot.
 * @param {string} waId - WhatsApp user id (from)
 * @returns {Promise<{ events: Array<{ id: string, title: string, occurrences: Array }>, error?: boolean }>}
 */
export async function getEventsByPublisher(waId) {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  const url = `${baseUrl}/api/events/by-publisher?waId=${encodeURIComponent(String(waId))}`
  const headers = { Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey
  try {
    const res = await fetch(url, { method: 'GET', headers })
    if (!res.ok) {
      logger.error(LOG_PREFIXES.CLOUD_API, 'Events by-publisher failed', res.status)
      return { events: [], error: true }
    }
    const data = await res.json()
    return { events: Array.isArray(data.events) ? data.events : [] }
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Events by-publisher error', err)
    return { events: [], error: true }
  }
}

/**
 * Fetch one event by id (for wa-bot update flow). Returns frontend-shaped event.
 * @param {string} eventId - MongoDB event id
 * @param {string} [waId] - Optional; if provided, server verifies ownership
 * @returns {Promise<object|null>} Transformed event or null if not found / not owner
 */
export async function getEventById(eventId, waId) {
  const baseUrl = (config.galiluzAppUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  let url = `${baseUrl}/api/events/${encodeURIComponent(String(eventId))}`
  if (waId) url += `?waId=${encodeURIComponent(String(waId))}`
  const headers = { Accept: 'application/json' }
  if (config.galiluzAppApiKey) headers['X-API-Key'] = config.galiluzAppApiKey
  try {
    const res = await fetch(url, { method: 'GET', headers })
    if (res.status === 404 || !res.ok) return null
    return await res.json()
  } catch (err) {
    logger.error(LOG_PREFIXES.CLOUD_API, 'Events get by id error', err)
    return null
  }
}

/**
 * Delete an event (user-initiated from wa-bot).
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

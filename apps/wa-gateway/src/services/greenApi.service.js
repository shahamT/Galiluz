import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

/**
 * Generic Green API client — the single bridge to the WhatsApp Business account.
 * Every Green API call has the shape:
 *   {host}/waInstance{idInstance}/{method}/{apiTokenInstance}[/{suffix}]
 * Methods are intentionally thin wrappers so new actions are cheap to add.
 *
 * Docs: https://green-api.com/en/docs/api/
 */

// Redact secret-bearing fields from any response text before it reaches the logs
// (e.g. getSettings returns webhookUrlToken).
function redactSecrets(text) {
  return text.replace(/("(?:webhookUrlToken|apiTokenInstance)"\s*:\s*")[^"]*/g, '$1***')
}

function buildUrl(method, { useMedia = false, suffix = '' } = {}) {
  const { idInstance, apiToken, baseUrl, mediaUrl } = config.greenApi
  const host = useMedia ? mediaUrl : baseUrl
  return `${host}/waInstance${idInstance}/${method}/${apiToken}${suffix ? `/${suffix}` : ''}`
}

async function request(method, { httpMethod = 'POST', body = null, useMedia = false, suffix = '' } = {}) {
  const url = buildUrl(method, { useMedia, suffix })
  // Redact the instance token before any URL reaches the logs.
  const safeUrl = config.greenApi.apiToken ? url.split(config.greenApi.apiToken).join('***') : url
  let res
  try {
    res = await fetch(url, {
      method: httpMethod,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    logger.error(LOG_PREFIXES.GREEN_API, `${httpMethod} ${method} network error → ${safeUrl}: ${err instanceof Error ? err.message : String(err)}`)
    throw new Error(`green_api_unreachable:${method}`)
  }

  const text = await res.text()
  if (!res.ok) {
    // Green API returns useful error bodies — surface them (secrets redacted).
    logger.error(LOG_PREFIXES.GREEN_API, `${method} FAILED ${res.status} → ${safeUrl} :: ${redactSecrets(text).slice(0, 1000)}`)
    throw new Error(`green_api_error:${method}:${res.status}`)
  }
  // Success: log the RESPONSE body (never the request payload — it may hold the
  // OTP — and with secret fields like webhookUrlToken redacted). getContacts returns the
  // whole contact list (large + PII) — log only its size, not the entries.
  let logBody
  if (method === 'getContacts') {
    let count = 0
    try { const arr = JSON.parse(text); if (Array.isArray(arr)) count = arr.length } catch { /* ignore */ }
    logBody = `${count} contacts`
  } else if (method === 'getChatHistory') {
    // Private DM content — log only the message count, never the bodies.
    let count = 0
    try { const arr = JSON.parse(text); if (Array.isArray(arr)) count = arr.length } catch { /* ignore */ }
    logBody = `${count} messages`
  } else {
    logBody = redactSecrets(text).slice(0, 1000)
  }
  logger.info(LOG_PREFIXES.GREEN_API, `${method} ok ${res.status} :: ${logBody}`)
  try { return text ? JSON.parse(text) : {} } catch { return { raw: text } }
}

// ── Actions ────────────────────────────────────────────────────────────────

/**
 * Send a plain-text message. `chatId` e.g. 972526052835@c.us or <id>@g.us.
 *
 * linkPreview is forced OFF: Green API defaults it to true, which makes WhatsApp
 * FETCH any URL in the message to build a preview. For our single-use magic links
 * that fetch hits /api/auth/magic-link and BURNS the token before the user taps it,
 * so they'd land on /login. All gateway messages are transactional (OTP codes,
 * magic links) and never want a preview anyway.
 */
export function sendMessage(chatId, message) {
  return request('sendMessage', { body: { chatId, message, linkPreview: false } })
}

/** Last `count` messages of a chat (both directions, most-recent first). `chatId` e.g. 972...@c.us. */
export function getChatHistory(chatId, count = 20) {
  return request('getChatHistory', { body: { chatId, count } })
}

/** Instance auth/health state → { stateInstance: 'authorized' | 'notAuthorized' | ... }. */
export function getStateInstance() {
  return request('getStateInstance', { httpMethod: 'GET' })
}

/** All chats/contacts (users + groups) → [{ id, name, type:'user'|'group' }]. Filter to groups by id @g.us. */
export function getContacts() {
  return request('getContacts', { httpMethod: 'GET' })
}

/** Send a file by URL (future use — media host). */
export function sendFileByUrl(chatId, urlFile, fileName, caption = '') {
  return request('sendFileByUrl', { useMedia: true, body: { chatId, urlFile, fileName, caption } })
}

/** Read current instance settings (future — e.g. to inspect the webhook config). */
export function getSettings() {
  return request('getSettings', { httpMethod: 'GET' })
}

/** Update instance settings, e.g. enable the incoming webhook (future). */
export function setSettings(settings) {
  return request('setSettings', { body: settings })
}

/** Long-poll the incoming-notification queue (future — alternative to webhooks). */
export function receiveNotification() {
  return request('receiveNotification', { httpMethod: 'GET' })
}

/** Acknowledge/remove a notification from the queue (future). */
export function deleteNotification(receiptId) {
  return request('deleteNotification', { httpMethod: 'DELETE', suffix: String(receiptId) })
}

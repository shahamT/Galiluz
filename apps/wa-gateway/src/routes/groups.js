import { sendJson } from '../utils/http.js'
import { getContacts } from '../services/greenApi.service.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'

/**
 * GET /internal/groups — the WhatsApp groups the business number belongs to
 * (API_SECRET-gated). Used by the admin "add group" picker. Filters getContacts
 * to group chats (id ends @g.us / type 'group').
 */
export async function handleGroups(req, res) {
  try {
    const contacts = await getContacts()
    const groups = (Array.isArray(contacts) ? contacts : [])
      .filter((c) => c && (c.type === 'group' || String(c.id || '').endsWith('@g.us')))
      .map((c) => ({ chatId: c.id, name: c.name || c.contactName || c.id }))
    return sendJson(res, 200, { groups })
  } catch (err) {
    logger.error(LOG_PREFIXES.GREEN_API, `getContacts failed: ${err instanceof Error ? err.message : String(err)}`)
    return sendJson(res, 502, { error: 'green_api_error' })
  }
}

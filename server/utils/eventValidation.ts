const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/
/** Minimal ISO date-time pattern for startTime (UTC). */
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

/**
 * Light structure validation for publisher-formatted events (wa-bot flow).
 * No justifications or evidence checks — we only validate shape and required fields.
 */
export function validatePublisherFormattedEvent(event: unknown): { valid: true } | { valid: false; reason: string } {
  if (!event || typeof event !== 'object') {
    return { valid: false, reason: 'Event is not an object' }
  }
  const e = event as Record<string, unknown>
  if (typeof e.Title !== 'string' || !e.Title.trim()) {
    return { valid: false, reason: 'Missing or empty Title' }
  }
  if (!Array.isArray(e.categories) || e.categories.length === 0) {
    return { valid: false, reason: 'Missing or empty categories' }
  }
  if (typeof e.mainCategory !== 'string' || !e.mainCategory.trim()) {
    return { valid: false, reason: 'Missing mainCategory' }
  }
  if (!e.categories.includes(e.mainCategory)) {
    return { valid: false, reason: 'mainCategory not in categories' }
  }
  if (!e.location || typeof e.location !== 'object') {
    return { valid: false, reason: 'Missing location' }
  }
  const loc = e.location as Record<string, unknown>
  if (typeof loc.City !== 'string') {
    return { valid: false, reason: 'Missing location.City' }
  }
  if (!Array.isArray(e.occurrences) || e.occurrences.length === 0) {
    return { valid: false, reason: 'Missing or empty occurrences' }
  }
  const occurrences = e.occurrences as unknown[]
  for (let i = 0; i < occurrences.length; i++) {
    const occ = occurrences[i]
    if (!occ || typeof occ !== 'object') {
      return { valid: false, reason: `occurrences[${i}] is not an object` }
    }
    const o = occ as Record<string, unknown>
    if (typeof o.date !== 'string' || !o.date.trim()) {
      return { valid: false, reason: `occurrences[${i}].date missing or empty` }
    }
    if (!YYYY_MM_DD.test(String(o.date).trim().slice(0, 10))) {
      return { valid: false, reason: `occurrences[${i}].date must be YYYY-MM-DD` }
    }
    if (typeof o.hasTime !== 'boolean') {
      return { valid: false, reason: `occurrences[${i}].hasTime missing or not boolean` }
    }
    if (typeof o.startTime !== 'string' || !o.startTime.trim()) {
      return { valid: false, reason: `occurrences[${i}].startTime missing or empty` }
    }
    if (!ISO_DATETIME.test(String(o.startTime).trim())) {
      return { valid: false, reason: `occurrences[${i}].startTime must be ISO 8601 date-time` }
    }
  }
  if (e.price !== null && (typeof e.price !== 'number' || !Number.isFinite(e.price))) {
    return { valid: false, reason: 'price must be number or null' }
  }
  return { valid: true }
}

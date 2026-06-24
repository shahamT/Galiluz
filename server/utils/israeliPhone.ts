/**
 * Normalize a raw phone string to the canonical Israeli WhatsApp id (972XXXXXXXXX).
 * Returns null when the input isn't a valid Israeli mobile/landline number, so callers
 * can reject it. Shared by the event create/edit paths (custom contact number) and the
 * publisher on-behalf flow; mirrors the same logic the crawler/OTP use.
 */
export function normalizeIsraeliPhone(raw: string): string | null {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.startsWith('972') && digits.length === 12) return digits
  if (digits.startsWith('05') && digits.length === 10) return '972' + digits.slice(1)
  if (digits.startsWith('5') && digits.length === 9) return '972' + digits
  return null
}

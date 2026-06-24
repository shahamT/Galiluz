/**
 * Resolve the public contact number to expose on an event (event.publisherPhone), from the
 * publisher's intent. Computed on write (create/edit/transfer) so the public read path stays
 * a passthrough — see docs note in the contact-controls plan.
 *
 *   - hidden (showContactPhone === false) → '' (no number sent to the front; button hidden)
 *   - custom number set                   → the custom number (the publisher's own is never exposed)
 *   - otherwise (own)                     → the publisher's own waId
 *
 * `showContactPhone` defaults to shown when undefined (legacy/crawler/backfilled events).
 */
export function resolveExposedContactPhone(input: {
  showContactPhone?: unknown
  customContactPhone?: unknown
  ownWaId?: unknown
}): string {
  if (input.showContactPhone === false) return ''
  const custom = typeof input.customContactPhone === 'string' ? input.customContactPhone.trim() : ''
  if (custom) return custom
  return typeof input.ownWaId === 'string' ? input.ownWaId : ''
}

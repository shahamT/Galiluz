import { randomBytes } from 'node:crypto'

/**
 * Assigns a request-scoped correlation id (honors an inbound X-Correlation-Id,
 * e.g. from the WhatsApp apps) so a single flow is greppable across logs.
 * Echoed back in the response for client-side bug reports.
 */
export default defineEventHandler((event) => {
  const inbound = getHeader(event, 'x-correlation-id')
  const correlationId = inbound && /^[\w-]{4,64}$/.test(inbound) ? inbound : randomBytes(4).toString('hex')
  event.context.correlationId = correlationId
  setHeader(event, 'X-Correlation-Id', correlationId)
})

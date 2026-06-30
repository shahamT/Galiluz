import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { listCredentials } from '~/server/utils/webauthn'

/** List the caller's enrolled passkeys (no public-key material) for the management UI. */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)
  const creds = await listCredentials(session.publisherId)
  return creds.map((c) => ({
    id: c.credentialId,
    deviceName: c.deviceName || '',
    createdAt: c.createdAt,
    lastUsedAt: c.lastUsedAt,
    transports: c.transports || [],
  }))
})

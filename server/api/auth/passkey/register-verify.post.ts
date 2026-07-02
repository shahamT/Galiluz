import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { logAuthEvent } from '~/server/utils/authLog'
import { finishPasskeyEnrollment } from '~/server/utils/webauthn'

/** Finish passkey enrollment: verify the attestation against the stored challenge + store it. */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)
  const body = await readBody<{ response?: unknown; deviceName?: string }>(event)
  const { credentials } = await finishPasskeyEnrollment(session.publisherId, body?.response, body?.deviceName)
  await logAuthEvent(event, 'passkey_enrolled', session.waId)
  return { success: true, credentials }
})

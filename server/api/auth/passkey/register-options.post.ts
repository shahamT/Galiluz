import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { startPasskeyEnrollment } from '~/server/utils/webauthn'

/**
 * Start passkey enrollment (any authenticated session). Returns the creation options and
 * stashes the challenge on the publisher doc for register-verify to check.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)
  return startPasskeyEnrollment(session.publisherId, session.fullName || session.waId)
})

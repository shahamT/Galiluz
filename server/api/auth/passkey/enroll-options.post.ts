import { resolvePublisherByEnrollToken, startPasskeyEnrollment } from '~/server/utils/webauthn'

/**
 * Cross-device enrollment step 1 (token-authorized, NO session): validate the enroll token and
 * return the WebAuthn creation options for the new device, plus a label to display.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ token?: string }>(event)
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const resolved = await resolvePublisherByEnrollToken(token)
  if (!resolved) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'invalid_token' })
  }
  const options = await startPasskeyEnrollment(resolved.publisherId, resolved.userName)
  return { options, label: resolved.label }
})

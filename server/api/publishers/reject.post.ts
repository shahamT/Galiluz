import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'
import { resolveActorName } from '~/server/utils/approvers'
import { rejectPublisher } from '~/server/utils/publisherApproval'

/**
 * Reject a publisher (wa-bot path, API-secret). Atomic first-wins + cascade (soft-delete events/stats,
 * then ghost or hard-delete + account/membership cleanup) live in the shared `rejectPublisher` core
 * (also used by the admin portal). `reason` is only for the rejection notice to the publisher.
 *
 * Body: { waId, actorWaId?, reason? }. Response: { applied:true, publisherName, actorName } on win,
 * or { applied:false, resolvedStatus, by, publisherName } when someone already acted.
 */
export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const body = await readBody<{ waId?: string; actorWaId?: string; reason?: string }>(event)
  const waId = typeof body?.waId === 'string' ? body.waId.trim() : ''
  const actorWaId = typeof body?.actorWaId === 'string' ? body.actorWaId.trim() : ''
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  if (!waId) throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'waId is required' })

  const config = useRuntimeConfig() as Record<string, string>
  if (!(config.mongodbUri || process.env.MONGODB_URI) || !(config.mongodbDbName || process.env.MONGODB_DB_NAME)) {
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
  }

  try {
    const { db } = await getMongoConnection()
    const actorName = actorWaId ? await resolveActorName(actorWaId) : 'מאשר'
    return await rejectPublisher(db, config, waId, { actorWaId, actorName }, event, reason || undefined)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    console.error('[PublishersAPI] Reject error:', err instanceof Error ? err.message : String(err))
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
  }
})

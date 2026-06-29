import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'
import { resolveActorName } from '~/server/utils/approvers'
import { approvePublisher } from '~/server/utils/publisherApproval'

/**
 * Approve a publisher (wa-bot path, API-secret). Atomic first-wins + side effects live in the shared
 * `approvePublisher` core (also used by the admin portal). Records who approved (actor) and returns a
 * structured result so the bot runs the side effects (winner) or tells a late approver it was handled.
 *
 * Body: { waId, actorWaId? }. Response: { applied, publisherName, actorName } on win, or
 * { applied:false, resolvedStatus, by, publisherName } when someone already acted.
 */
export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const body = await readBody<{ waId?: string; actorWaId?: string }>(event)
  const waId = typeof body?.waId === 'string' ? body.waId.trim() : ''
  const actorWaId = typeof body?.actorWaId === 'string' ? body.actorWaId.trim() : ''
  if (!waId) throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'waId is required' })

  const config = useRuntimeConfig() as Record<string, string>
  if (!(config.mongodbUri || process.env.MONGODB_URI) || !(config.mongodbDbName || process.env.MONGODB_DB_NAME)) {
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
  }

  try {
    const { db } = await getMongoConnection()
    const actorName = actorWaId ? await resolveActorName(actorWaId) : 'מאשר'
    return await approvePublisher(db, config, waId, { actorWaId, actorName })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    console.error('[PublishersAPI] Approve error:', err instanceof Error ? err.message : String(err))
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
  }
})

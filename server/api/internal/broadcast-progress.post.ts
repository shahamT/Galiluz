import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'

/**
 * POST /api/internal/broadcast-progress (ApiSecret) — the wa-gateway reports broadcast
 * progress here after each message (and a final done=true). Updates the `broadcasts` job
 * doc so the admin page can poll live success/failed counts. Best-effort by nature; the
 * final report is authoritative.
 */
export default defineEventHandler(async (event) => {
  requireApiSecret(event)

  const body = await readBody<{ broadcastId?: unknown; sentCount?: unknown; failedIds?: unknown; done?: unknown }>(event)
  const broadcastId = typeof body?.broadcastId === 'string' ? body.broadcastId : ''
  if (!broadcastId || !ObjectId.isValid(broadcastId)) {
    throw createError({ statusCode: 400, message: 'valid broadcastId required' })
  }
  const sentCount = Number.isFinite(Number(body?.sentCount)) ? Math.max(0, Math.trunc(Number(body.sentCount))) : 0
  const failedIds = Array.isArray(body?.failedIds) ? (body.failedIds as unknown[]).filter((x): x is string => typeof x === 'string') : []
  const done = body?.done === true

  const { db } = await getMongoConnection()
  const now = new Date()
  await db.collection('broadcasts').updateOne(
    { _id: new ObjectId(broadcastId) },
    {
      $set: {
        sentCount,
        failedIds,
        status: done ? 'done' : 'sending',
        updatedAt: now,
        ...(done ? { completedAt: now } : {}),
      },
    },
  )

  return { success: true }
})

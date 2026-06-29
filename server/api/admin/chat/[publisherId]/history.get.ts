import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { NOT_DELETED } from '~/server/utils/eventsQuery'
import { callGateway } from '~/server/utils/waGateway'

/**
 * Admin (platform-staff READ): the recent DM history with a publisher, fetched LIVE from Green API via
 * the gateway (no storage). `?count=` (default 20) loads more. Returns normalized messages.
 */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requirePlatformStaff: true })

  const id = getRouterParam(event, 'publisherId')
  if (!id || !ObjectId.isValid(id)) throw createError({ statusCode: 400, message: 'invalid id' })
  const count = Math.min(Math.max(parseInt(String(getQuery(event).count), 10) || 20, 1), 100)

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const pub = await db.collection(config.mongodbCollectionPublishers || 'publishers').findOne({ _id: new ObjectId(id), ...NOT_DELETED }, { projection: { waId: 1, fullName: 1 } })
  if (!pub?.waId) throw createError({ statusCode: 404, message: 'publisher not found' })

  try {
    const res = await callGateway<{ messages?: unknown[] }>('/internal/chat-history', { phone: pub.waId, count })
    return { messages: Array.isArray(res?.messages) ? res.messages : [], publisher: { name: pub.fullName || pub.waId, phone: pub.waId } }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 503) throw err
    throw createError({ statusCode: 502, statusMessage: 'Bad Gateway', message: 'gateway_error' })
  }
})

import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { NOT_DELETED } from '~/server/utils/eventsQuery'
import { callGateway } from '~/server/utils/waGateway'

/**
 * Admin (super_admin/owner): send a WhatsApp DM to a publisher via the gateway. Body: { message }.
 */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requireSuperAdmin: true })

  const id = getRouterParam(event, 'publisherId')
  if (!id || !ObjectId.isValid(id)) throw createError({ statusCode: 400, message: 'invalid id' })

  const body = await readBody<{ message?: string }>(event)
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!message) throw createError({ statusCode: 400, message: 'message required' })
  if (message.length > 4096) throw createError({ statusCode: 400, message: 'message too long' })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const pub = await db.collection(config.mongodbCollectionPublishers || 'publishers').findOne({ _id: new ObjectId(id), ...NOT_DELETED }, { projection: { waId: 1 } })
  if (!pub?.waId) throw createError({ statusCode: 404, message: 'publisher not found' })

  try {
    const res = await callGateway<{ idMessage?: string }>('/internal/send-message', { phone: pub.waId, message })
    return { success: true, idMessage: res?.idMessage || null }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 503) throw err
    throw createError({ statusCode: 502, statusMessage: 'Bad Gateway', message: 'gateway_error' })
  }
})

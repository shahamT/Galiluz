import { ObjectId } from 'mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { getMongoConnection } from '~/server/utils/mongodb'
import { PREFERENCE_KEYS } from '~/consts/preferences.const.js'

/**
 * Admin: set per-publisher preference flags. Manager-only. Whitelisted to the
 * registry keys (booleans). Only APPROVED (non-ghost) publishers are eligible —
 * ghosts can never be opted in.
 */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requireManager: true })

  const id = getRouterParam(event, 'id')
  if (!id || !ObjectId.isValid(id)) throw createError({ statusCode: 400, message: 'invalid id' })

  const body = await readBody<Record<string, unknown>>(event)
  const set: Record<string, boolean> = {}
  for (const k of PREFERENCE_KEYS) {
    if (typeof body?.[k] === 'boolean') set[`preferences.${k}`] = body[k] as boolean
  }
  if (Object.keys(set).length === 0) throw createError({ statusCode: 400, message: 'no valid preference provided' })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const publishers = db.collection(config.mongodbCollectionPublishers || 'publishers')
  const oid = new ObjectId(id)

  const doc = await publishers.findOne({ _id: oid }, { projection: { status: 1 } })
  if (!doc) throw createError({ statusCode: 404, message: 'publisher not found' })
  if (doc.status !== 'approved') throw createError({ statusCode: 422, message: 'publisher_not_approved' })

  await publishers.updateOne({ _id: oid }, { $set: set })
  return { success: true }
})

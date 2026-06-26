import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'
import { softDeleteEventStatsData } from '~/server/utils/eventStats.service'
import { logAuthEvent } from '~/server/utils/authLog'

export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const body = await readBody<{ waId: string; reason?: string }>(event)
  const waId = typeof body?.waId === 'string' ? body.waId.trim() : ''

  if (!waId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'waId is required',
    })
  }

  const config = useRuntimeConfig()
  const mongoUri = config.mongodbUri || process.env.MONGODB_URI
  const mongoDbName = config.mongodbDbName || process.env.MONGODB_DB_NAME
  const collectionName =
    config.mongodbCollectionPublishers ||
    process.env.MONGODB_COLLECTION_PUBLISHERS ||
    'publishers'

  if (!mongoUri || !mongoDbName) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
    })
  }

  try {
    const { db } = await getMongoConnection()
    const collection = db.collection(collectionName)
    const doc = await collection.findOne({ waId })
    if (!doc) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: 'Publisher not found',
      })
    }
    // Cascade: soft-delete the publisher's events (published + drafts) so nothing is stranded
    const eventsCol = db.collection(
      (config.mongodbCollectionEventsWaBot as string) || (config.mongodbCollectionEvents as string) || 'events',
    )
    const publisherId = doc._id.toString()
    const deletedAt = new Date()
    const theirEvents = await eventsCol.find(
      {
        $or: [{ 'event.publisherId': publisherId }, { 'rawEvent.publisher.waId': waId }],
        deletedAt: { $exists: false },
      },
      { projection: { _id: 1 } },
    ).toArray()

    for (const ev of theirEvents) {
      const id = ev._id.toString()
      await eventsCol.updateOne({ _id: ev._id }, { $set: { deletedAt, isActive: false } })
      await softDeleteEventStatsData(id, deletedAt)
    }

    if (doc.createdOnBehalf) {
      await collection.updateOne({ waId }, { $set: { status: 'ghost', updatedAt: new Date() } })
    } else {
      await collection.deleteOne({ waId })

      // Remove the publisher's memberships (owner of their account + any platform staff role) so
      // none are left orphaned pointing at a deleted publisher. Ghost records keep theirs.
      const membershipsCol = db.collection((config.mongodbCollectionMemberships as string) || 'memberships')
      await membershipsCol.deleteMany({ publisherId })

      // Release the publisher's account if no other publishers remain in it
      // (ghost records keep their publisher, so this only runs on hard delete).
      if (doc.accountId) {
        const remaining = await collection.countDocuments({ accountId: doc.accountId })
        if (remaining === 0) {
          try {
            const accountsCol = db.collection((config.mongodbCollectionAccounts as string) || 'accounts')
            await accountsCol.updateOne(
              { _id: new ObjectId(String(doc.accountId)) },
              { $set: { deletedAt: new Date(), isActive: false } },
            )
          } catch (e) {
            console.warn('[PublishersAPI] Reject: could not release account', doc.accountId, e instanceof Error ? e.message : e)
          }
        }
      }
    }

    await logAuthEvent(event, 'publisher_rejected', waId, { cascadedEvents: theirEvents.length })

    return { success: true }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    console.error('[PublishersAPI] Reject error:', err instanceof Error ? err.message : String(err))
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    })
  }
})

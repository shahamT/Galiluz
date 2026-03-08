import { getMongoConnection, getDbConfig } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'

interface RegisterBody {
  waId: string
  profileName?: string
  fullName: string
  publishingAs: string
  eventTypesDescription: string
}

export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const body = await readBody<RegisterBody>(event)

  const waId = typeof body?.waId === 'string' ? body.waId.trim() : ''
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : ''
  const publishingAs = typeof body?.publishingAs === 'string' ? body.publishingAs.trim() : ''
  const eventTypesDescription =
    typeof body?.eventTypesDescription === 'string' ? body.eventTypesDescription.trim() : ''
  const profileName = typeof body?.profileName === 'string' ? body.profileName.trim() : undefined

  if (!waId || !fullName || !publishingAs || !eventTypesDescription) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'waId, fullName, publishingAs, eventTypesDescription are required',
    })
  }

  const { uri, dbName, collections } = getDbConfig()

  if (!uri || !dbName) {
    console.error('[PublishersAPI] MongoDB not configured')
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
    })
  }

  try {
    const { db } = await getMongoConnection()
    const collection = db.collection(collections.publishers)

    await collection.createIndex({ waId: 1 }, { unique: true }).catch(() => {
      // Index may already exist
    })

    const now = new Date()
    await collection.updateOne(
      { waId },
      {
        $set: {
          profileName: profileName ?? null,
          fullName,
          publishingAs,
          eventTypesDescription,
          status: 'pending',
          updatedAt: now,
        },
        $setOnInsert: {
          waId,
          createdAt: now,
        },
      },
      { upsert: true },
    )

    return { success: true }
  } catch (err) {
    console.error('[PublishersAPI] Register error:', err instanceof Error ? err.message : String(err))
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    })
  }
})

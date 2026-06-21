import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'

interface RegisterBody {
  waId: string
  fullName: string
  // The account name. The wa-bot still sends it as `publishingAs`; we accept either
  // and store it as `accountName` (it becomes accounts.title on approval).
  accountName?: string
  publishingAs?: string
  eventTypesDescription: string
  approvedTerms?: boolean
}

export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const body = await readBody<RegisterBody>(event)

  const waId = typeof body?.waId === 'string' ? body.waId.trim() : ''
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : ''
  const accountName = (typeof body?.accountName === 'string' ? body.accountName
    : typeof body?.publishingAs === 'string' ? body.publishingAs : '').trim()
  const eventTypesDescription =
    typeof body?.eventTypesDescription === 'string' ? body.eventTypesDescription.trim() : ''

  if (!waId || !fullName || !accountName || !eventTypesDescription) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'waId, fullName, accountName/publishingAs, eventTypesDescription are required',
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
    console.error('[PublishersAPI] MongoDB not configured')
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
    })
  }

  try {
    const { db } = await getMongoConnection()
    const collection = db.collection(collectionName)

    await collection.createIndex({ waId: 1 }, { unique: true }).catch(() => {
      // Index may already exist
    })

    const now = new Date()
    await collection.updateOne(
      { waId },
      {
        $set: {
          fullName,
          accountName,
          eventTypesDescription,
          status: 'pending',
          type: 'publisher',
          createdOnBehalf: false,
          approvedTerms: body?.approvedTerms === true,
          approvedTermsAt: body?.approvedTerms === true ? now : null,
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

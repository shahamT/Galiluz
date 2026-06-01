import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { getMongoConnection } from '~/server/utils/mongodb'

export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)

  const config = useRuntimeConfig()
  const { db } = await getMongoConnection()
  const col = db.collection(config.mongodbCollectionPublishers || 'publishers')

  await col.updateOne(
    { waId: session.waId },
    { $unset: { authKey: '', authKeyExpiresAt: '' } },
  )

  return { success: true }
})

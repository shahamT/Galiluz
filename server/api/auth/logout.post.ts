import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { getMongoConnection } from '~/server/utils/mongodb'
import { logAuthEvent } from '~/server/utils/authLog'

export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)

  const config = useRuntimeConfig()
  const { db } = await getMongoConnection()
  const col = db.collection(config.mongodbCollectionPublishers || 'publishers')

  await col.updateOne(
    { waId: session.waId },
    { $unset: { authKey: '', authKeyExpiresAt: '' } },
  )

  // Clear the HttpOnly cookie
  deleteCookie(event, 'galiluz_auth', {
    path: '/api',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    httpOnly: true,
  })

  await logAuthEvent(event, 'logout', session.waId)
  return { success: true }
})

import { requireApiSecret } from '~/server/utils/requireApiSecret'
import { destroyOnCloudinary } from '~/server/utils/cloudinary'

interface DeleteItem {
  publicId: string
  resourceType?: 'image' | 'video' | 'raw'
}

interface DeleteBody {
  items: DeleteItem[]
}

export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const body = await readBody<DeleteBody>(event)

  const items = Array.isArray(body?.items) ? body.items : []
  const validItems = items.filter(
    (item): item is DeleteItem =>
      typeof item?.publicId === 'string' && item.publicId.length > 0,
  )

  if (validItems.length === 0) {
    return { success: true }
  }

  const config = useRuntimeConfig()
  const cloudName = config.cloudinaryCloudName
  const apiKey = config.cloudinaryApiKey
  const apiSecret = config.cloudinaryApiSecret

  if (!cloudName || !apiKey || !apiSecret) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
      message: 'Cloudinary not configured',
    })
  }

  const results = await Promise.all(
    validItems.map((item) =>
      destroyOnCloudinary(
        item.publicId,
        item.resourceType || 'image',
        cloudName,
        apiKey,
        apiSecret,
      ),
    ),
  )

  const allOk = results.every(Boolean)
  return { success: allOk }
})

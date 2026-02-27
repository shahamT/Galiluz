import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { checkRateLimit } from '~/server/utils/rateLimit'

/**
 * Extracts the document ID from event param (supports both "docId" and "docId-0" flat format).
 */
function extractDocumentId(param: string): string | null {
  if (!param || typeof param !== 'string') return null
  const trimmed = param.trim()
  if (!trimmed) return null
  const parts = trimmed.split('-')
  return parts[0] || trimmed
}

/**
 * For Cloudinary video URLs, returns a thumbnail image URL. Otherwise returns the original URL.
 */
function getImageUrlForMeta(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null
  if (!/\/video\/upload\//i.test(url)) return url
  try {
    const uploadMatch = url.match(/^(.+\/video\/upload\/)(.+)$/i)
    if (!uploadMatch) return url
    const [, prefix, rest] = uploadMatch
    const [pathPart, ...queryParts] = rest.split('?')
    const query = queryParts.length ? '?' + queryParts.join('?') : ''
    const pathWithJpg = pathPart.replace(/\.[^.\/]+$/i, '.jpg')
    return `${prefix}so_0/${pathWithJpg}${query}`
  } catch {
    return url
  }
}

/**
 * Gets the first media URL from event media array.
 * Prefers item with isMain === true; else uses first item.
 */
function getFirstMediaUrl(media: unknown[]): string | null {
  if (!Array.isArray(media) || media.length === 0) return null
  const mainItem = media.find(
    (m) => m && typeof m === 'object' && (m as Record<string, unknown>).isMain === true
  )
  const chosen = mainItem ?? media[0]
  if (typeof chosen === 'string') return getImageUrlForMeta(chosen)
  if (chosen && typeof chosen === 'object') {
    const url =
      (chosen as Record<string, unknown>).cloudinaryURL ??
      (chosen as Record<string, unknown>).url
    if (typeof url === 'string') return getImageUrlForMeta(url)
  }
  return null
}

/**
 * GET /api/events/[id]/meta
 * Public, rate-limited. Returns minimal event data for SEO meta tags.
 * Supports both document id (abc123) and flat occurrence id (abc123-0).
 */
export default defineEventHandler(async (event) => {
  await checkRateLimit(event)
  const idParam = getRouterParam(event, 'id')
  if (!idParam) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'id required' })
  }

  const docId = extractDocumentId(idParam)
  if (!docId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid id' })
  }

  let objectId: ObjectId
  try {
    objectId = new ObjectId(docId)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'event not found' })
  }

  const config = useRuntimeConfig()
  const mongoUri = config.mongodbUri || process.env.MONGODB_URI
  const mongoDbName = config.mongodbDbName || process.env.MONGODB_DB_NAME
  const collectionName =
    config.mongodbCollectionEvents || process.env.MONGODB_COLLECTION_EVENTS || 'events'

  if (!mongoUri || !mongoDbName) {
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
  }

  const { db } = await getMongoConnection()
  const collection = db.collection(collectionName)
  const doc = await collection.findOne({ _id: objectId })
  if (!doc) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'event not found' })
  }

  if (doc.isActive === false) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'event not found' })
  }

  const backendEvent = doc.event
  if (!backendEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'event not found' })
  }

  const title = backendEvent.Title || ''
  const shortDescription = backendEvent.shortDescription || ''
  const media = backendEvent.media || []
  const imageUrl = getFirstMediaUrl(media)

  return {
    title,
    shortDescription,
    imageUrl,
  }
})

import { ObjectId } from 'mongodb'
import { getMongoConnection, getDbConfig } from '~/server/utils/mongodb'

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

const OG_TRANSFORM = 'c_fill,g_auto,w_1200,h_630'

/**
 * Returns a Cloudinary URL optimized for OG/social share (1200×630).
 * - Image URLs: injects crop transformation.
 * - Video URLs: extracts first-frame thumbnail + crop.
 * - Non-Cloudinary URLs: returned as-is.
 */
function getImageUrlForMeta(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null
  try {
    const [pathPart, ...queryParts] = url.split('?')
    const query = queryParts.length ? '?' + queryParts.join('?') : ''

    // Cloudinary image: inject OG crop transformation
    const imgMatch = pathPart.match(/^(.+\/image\/upload\/)(.+)$/i)
    if (imgMatch) {
      const [, prefix, rest] = imgMatch
      return `${prefix}${OG_TRANSFORM}/${rest}${query}`
    }

    // Cloudinary video: first-frame thumbnail + OG crop
    const vidMatch = pathPart.match(/^(.+\/video\/upload\/)(.+)$/i)
    if (vidMatch) {
      const [, prefix, rest] = vidMatch
      const restWithJpg = rest.replace(/\.[^.\/]+$/i, '.jpg')
      return `${prefix}so_0,${OG_TRANSFORM}/${restWithJpg}${query}`
    }

    return url
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

  const { uri, dbName, collections } = getDbConfig()

  if (!uri || !dbName) {
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
  }

  const { db } = await getMongoConnection()
  const collection = db.collection(collections.events)
  const doc = await collection.findOne({ _id: objectId }, { projection: { rawEvent: 0 } })
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

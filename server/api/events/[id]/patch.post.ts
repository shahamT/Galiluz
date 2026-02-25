import { randomBytes } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { getCategoriesList } from '~/server/consts/events.const'
import { PUBLISHER_EVENT_MAX_CATEGORIES } from '~/server/consts/publisherEventConsts'
import {
  validatePublisherFormattedEvent,
  normalizePublisherFormattedEvent,
} from '~/server/utils/eventValidation'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requireApiSecret } from '~/server/utils/requireApiSecret'

const LOG_PREFIX = '[EventsAPI] Patch'

/** Partial location update (wa-bot edit flow). All fields optional. */
interface PatchLocation {
  City?: string
  locationName?: string
  addressLine1?: string | null
  addressLine2?: string | null
  locationDetails?: string | null
  wazeNavLink?: string | null
  gmapsNavLink?: string | null
}

/** Partial event updates (wa-bot edit flow). All fields optional. */
interface PatchBody {
  title?: string
  Title?: string
  shortDescription?: string
  fullDescription?: string
  mainCategory?: string
  categories?: string[]
  location?: PatchLocation
}

/**
 * PATCH draft: merge partial event updates into doc.event.
 * Only for non-active drafts. Returns updated event for preview refresh.
 */
export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'id required' })
  }

  const body = await readBody<PatchBody>(event)
  if (!body || typeof body !== 'object') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'body must be an object',
    })
  }

  let objectId: ObjectId
  try {
    objectId = new ObjectId(id)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'invalid id' })
  }

  const correlationId = randomBytes(4).toString('hex')
  const config = useRuntimeConfig()
  const mongoUri = config.mongodbUri || process.env.MONGODB_URI
  const mongoDbName = config.mongodbDbName || process.env.MONGODB_DB_NAME
  const eventsCollectionName =
    config.mongodbCollectionEventsWaBot ||
    config.mongodbCollectionEvents ||
    process.env.MONGODB_COLLECTION_EVENTS ||
    'events'

  if (!mongoUri || !mongoDbName) {
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
  }

  const { db } = await getMongoConnection()
  const collection = db.collection(eventsCollectionName)
  const doc = await collection.findOne({ _id: objectId })
  if (!doc) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'draft not found' })
  }
  if (doc.event == null) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'draft not yet processed',
    })
  }
  if (doc.isActive === true) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'cannot patch active event',
    })
  }

  const currentEvent = doc.event as Record<string, unknown>
  const updates: Record<string, unknown> = {}

  if (body.title !== undefined && typeof body.title === 'string') {
    updates.Title = body.title.trim()
  }
  if (body.Title !== undefined && typeof body.Title === 'string') {
    updates.Title = body.Title.trim()
  }
  if (body.shortDescription !== undefined && typeof body.shortDescription === 'string') {
    updates.shortDescription = body.shortDescription
  }
  if (body.fullDescription !== undefined && typeof body.fullDescription === 'string') {
    updates.fullDescription = body.fullDescription
  }
  if (body.mainCategory !== undefined && typeof body.mainCategory === 'string') {
    updates.mainCategory = body.mainCategory.trim()
  }
  if (Array.isArray(body.categories)) {
    updates.categories = body.categories.filter((c) => typeof c === 'string')
  }
  if (body.location !== undefined && body.location !== null && typeof body.location === 'object') {
    const loc = body.location as Record<string, unknown>
    const locationUpdate: Record<string, unknown> = {}
    if (loc.City !== undefined) locationUpdate.City = typeof loc.City === 'string' ? loc.City.trim() : ''
    if (loc.locationName !== undefined) locationUpdate.locationName = typeof loc.locationName === 'string' ? loc.locationName.trim() : undefined
    if (loc.addressLine1 !== undefined) locationUpdate.addressLine1 = typeof loc.addressLine1 === 'string' ? loc.addressLine1 : null
    if (loc.addressLine2 !== undefined) locationUpdate.addressLine2 = typeof loc.addressLine2 === 'string' ? loc.addressLine2 : null
    if (loc.locationDetails !== undefined) locationUpdate.locationDetails = typeof loc.locationDetails === 'string' ? loc.locationDetails : null
    if (loc.wazeNavLink !== undefined) locationUpdate.wazeNavLink = typeof loc.wazeNavLink === 'string' && loc.wazeNavLink.trim() ? loc.wazeNavLink.trim() : null
    if (loc.gmapsNavLink !== undefined) locationUpdate.gmapsNavLink = typeof loc.gmapsNavLink === 'string' && loc.gmapsNavLink.trim() ? loc.gmapsNavLink.trim() : null
    if (Object.keys(locationUpdate).length > 0) {
      updates.location = locationUpdate
    }
  }

  const mergedEvent = { ...currentEvent, ...updates } as Record<string, unknown>

  if (updates.location) {
    const currentLoc = (currentEvent.location && typeof currentEvent.location === 'object'
      ? { ...(currentEvent.location as Record<string, unknown>) }
      : {}) as Record<string, unknown>
    mergedEvent.location = { ...currentLoc, ...(updates.location as Record<string, unknown>) }
  }

  if (updates.mainCategory !== undefined || updates.categories !== undefined) {
    const validCategoryIds = getCategoriesList().map((c) => c.id)
    const main = (mergedEvent.mainCategory as string) || ''
    let cats = Array.isArray(mergedEvent.categories) ? (mergedEvent.categories as string[]) : []
    const validCats = cats.filter((c) => typeof c === 'string' && validCategoryIds.includes(c))
    if (main && validCategoryIds.includes(main) && !validCats.includes(main)) {
      validCats.unshift(main)
    }
    if (validCats.length === 0 && main && validCategoryIds.includes(main)) {
      validCats.push(main)
    }
    if (validCats.length > PUBLISHER_EVENT_MAX_CATEGORIES) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Unprocessable Entity',
        message: `categories exceed maximum of ${PUBLISHER_EVENT_MAX_CATEGORIES}`,
      })
    }
    mergedEvent.categories = validCats.length > 0 ? validCats : (currentEvent.categories as string[]) || []
    mergedEvent.mainCategory = main || (mergedEvent.categories as string[])?.[0]
    normalizePublisherFormattedEvent(mergedEvent as Record<string, unknown>, validCategoryIds)
    const validation = validatePublisherFormattedEvent(mergedEvent)
    if (!validation.valid) {
      console.warn(LOG_PREFIX, correlationId, 'validation failed', JSON.stringify({ id, reason: validation.reason }))
      throw createError({
        statusCode: 422,
        statusMessage: 'Unprocessable Entity',
        message: validation.reason,
      })
    }
  }

  const updateResult = await collection.updateOne(
    { _id: objectId },
    { $set: { event: mergedEvent, updatedAt: new Date() } }
  )
  if (updateResult.matchedCount === 0) {
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
  }
  console.info(LOG_PREFIX, correlationId, 'draft patched', JSON.stringify({ id }))
  return { success: true, event: mergedEvent }
})

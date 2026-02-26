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
import { logEventEdit } from '~/server/utils/eventLogs.service'

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

/** Single URL item (edit flow). */
interface PatchUrl {
  Title: string
  Url: string
  type?: 'link' | 'phone'
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
  occurrences?: Array<{ date: string; hasTime: boolean; startTime: string; endTime: string | null }>
  price?: number | null
  urls?: PatchUrl[]
  media?: unknown[]
  /** Meta for logging only; not applied to event. */
  _meta?: { editSource?: string }
}

/**
 * PATCH event: merge partial event updates into doc.event.
 * Allowed for both non-active drafts (edit before save) and active events (update-event flow).
 * Returns updated event for preview refresh.
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

  const _meta = body._meta && typeof body._meta === 'object' ? body._meta : undefined
  const editSource = _meta?.editSource && typeof _meta.editSource === 'string' ? _meta.editSource : undefined
  delete (body as Record<string, unknown>)._meta

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
  // Allow patch for both drafts (edit before save) and active events (update-event flow).

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

  if (Array.isArray(body.occurrences) && body.occurrences.length > 0) {
    updates.occurrences = body.occurrences
  }
  if (body.price !== undefined) {
    updates.price = body.price === null || (typeof body.price === 'number' && Number.isFinite(body.price)) ? body.price : currentEvent.price
  }
  if (Array.isArray(body.urls)) {
    updates.urls = body.urls.filter(
      (u): u is PatchUrl => u != null && typeof u === 'object' && typeof (u as PatchUrl).Title === 'string' && typeof (u as PatchUrl).Url === 'string'
    ).map((u) => ({ Title: u.Title, Url: u.Url, type: u.type === 'phone' ? 'phone' : 'link' }))
  }
  if (Array.isArray(body.media)) {
    updates.media = body.media
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
  }

  if (updates.occurrences !== undefined) {
    const validCategoryIds = getCategoriesList().map((c) => c.id)
    normalizePublisherFormattedEvent(mergedEvent as Record<string, unknown>, validCategoryIds)
  }

  if (Object.keys(updates).length > 0) {
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

  const setPayload: Record<string, unknown> = { event: mergedEvent, updatedAt: new Date() }

  const rawEventUpdates: Record<string, unknown> = {}
  if (updates.Title !== undefined) {
    rawEventUpdates['rawEvent.rawTitle'] = typeof mergedEvent.Title === 'string' ? mergedEvent.Title.trim() : ''
  }
  if (updates.fullDescription !== undefined) {
    rawEventUpdates['rawEvent.rawFullDescription'] = typeof body.fullDescription === 'string' ? body.fullDescription : ''
  }
  if (updates.mainCategory !== undefined || updates.categories !== undefined) {
    rawEventUpdates['rawEvent.rawMainCategory'] = typeof mergedEvent.mainCategory === 'string' ? mergedEvent.mainCategory : ''
    rawEventUpdates['rawEvent.rawCategories'] = Array.isArray(mergedEvent.categories) ? mergedEvent.categories : []
  }
  if (updates.location !== undefined) {
    const loc = mergedEvent.location && typeof mergedEvent.location === 'object' ? mergedEvent.location as Record<string, unknown> : {}
    const locBody = body.location && typeof body.location === 'object' ? body.location as Record<string, unknown> : {}
    if (locBody.City !== undefined) rawEventUpdates['rawEvent.rawCity'] = typeof loc.City === 'string' ? loc.City : ''
    if (locBody.locationName !== undefined) rawEventUpdates['rawEvent.rawLocationName'] = typeof loc.locationName === 'string' ? loc.locationName : ''
    if (locBody.addressLine1 !== undefined) rawEventUpdates['rawEvent.rawAddressLine1'] = loc.addressLine1 != null ? String(loc.addressLine1) : ''
    if (locBody.addressLine2 !== undefined) rawEventUpdates['rawEvent.rawAddressLine2'] = loc.addressLine2 != null ? String(loc.addressLine2) : ''
    if (locBody.locationDetails !== undefined) rawEventUpdates['rawEvent.rawLocationDetails'] = loc.locationDetails != null ? String(loc.locationDetails) : ''
    if (locBody.wazeNavLink !== undefined || locBody.gmapsNavLink !== undefined) {
      const parts = []
      if (loc.wazeNavLink && String(loc.wazeNavLink).trim()) parts.push(String(loc.wazeNavLink).trim())
      if (loc.gmapsNavLink && String(loc.gmapsNavLink).trim()) parts.push(String(loc.gmapsNavLink).trim())
      rawEventUpdates['rawEvent.rawNavLinks'] = parts.join('\n') || ''
    }
  }
  if (updates.occurrences !== undefined && Array.isArray(body.occurrences)) {
    rawEventUpdates['rawEvent.rawOccurrences'] = JSON.stringify(body.occurrences)
  }
  if (updates.price !== undefined) {
    rawEventUpdates['rawEvent.rawPrice'] = body.price === null ? '' : String(body.price)
  }
  if (updates.urls !== undefined && Array.isArray(body.urls)) {
    rawEventUpdates['rawEvent.rawUrls'] = JSON.stringify(
      body.urls.filter(
        (u): u is PatchUrl => u != null && typeof u === 'object' && typeof (u as PatchUrl).Title === 'string' && typeof (u as PatchUrl).Url === 'string'
      ).map((u) => ({ Title: u.Title, Url: u.Url, type: u.type === 'phone' ? 'phone' : 'link' }))
    )
  }
  if (updates.media !== undefined && Array.isArray(body.media)) {
    rawEventUpdates['rawEvent.rawMedia'] = body.media
  }

  Object.assign(setPayload, rawEventUpdates)

  const updateResult = await collection.updateOne(
    { _id: objectId },
    { $set: setPayload }
  )
  if (updateResult.matchedCount === 0) {
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
  }
  console.info(LOG_PREFIX, correlationId, 'draft patched', JSON.stringify({ id }))

  if (Object.keys(updates).length > 0) {
    const changedFields = Object.keys(updates)
    const currentRaw = (doc.rawEvent || {}) as Record<string, unknown>
    const previousFinal: Record<string, unknown> = {}
    const previousRaw: Record<string, unknown> = {}
    const newFinal: Record<string, unknown> = {}
    const newRaw: Record<string, unknown> = {}
    for (const key of changedFields) {
      if (currentEvent[key] !== undefined) previousFinal[key] = currentEvent[key]
      if (mergedEvent[key] !== undefined) newFinal[key] = mergedEvent[key]
    }
    if (updates.Title !== undefined) {
      previousRaw.rawTitle = currentRaw.rawTitle
      newRaw.rawTitle = rawEventUpdates['rawEvent.rawTitle']
    }
    if (updates.fullDescription !== undefined) {
      previousRaw.rawFullDescription = currentRaw.rawFullDescription
      newRaw.rawFullDescription = rawEventUpdates['rawEvent.rawFullDescription']
    }
    if (updates.mainCategory !== undefined || updates.categories !== undefined) {
      previousRaw.rawMainCategory = currentRaw.rawMainCategory
      previousRaw.rawCategories = currentRaw.rawCategories
      newRaw.rawMainCategory = rawEventUpdates['rawEvent.rawMainCategory']
      newRaw.rawCategories = rawEventUpdates['rawEvent.rawCategories']
    }
    if (updates.location !== undefined) {
      previousRaw.rawCity = currentRaw.rawCity
      previousRaw.rawLocationName = currentRaw.rawLocationName
      previousRaw.rawAddressLine1 = currentRaw.rawAddressLine1
      previousRaw.rawAddressLine2 = currentRaw.rawAddressLine2
      previousRaw.rawLocationDetails = currentRaw.rawLocationDetails
      previousRaw.rawNavLinks = currentRaw.rawNavLinks
      newRaw.rawCity = rawEventUpdates['rawEvent.rawCity']
      newRaw.rawLocationName = rawEventUpdates['rawEvent.rawLocationName']
      newRaw.rawAddressLine1 = rawEventUpdates['rawEvent.rawAddressLine1']
      newRaw.rawAddressLine2 = rawEventUpdates['rawEvent.rawAddressLine2']
      newRaw.rawLocationDetails = rawEventUpdates['rawEvent.rawLocationDetails']
      newRaw.rawNavLinks = rawEventUpdates['rawEvent.rawNavLinks']
    }
    if (updates.occurrences !== undefined) {
      previousRaw.rawOccurrences = currentRaw.rawOccurrences
      newRaw.rawOccurrences = rawEventUpdates['rawEvent.rawOccurrences']
    }
    if (updates.price !== undefined) {
      previousRaw.rawPrice = currentRaw.rawPrice
      newRaw.rawPrice = rawEventUpdates['rawEvent.rawPrice']
    }
    if (updates.urls !== undefined) {
      previousRaw.rawUrls = currentRaw.rawUrls
      newRaw.rawUrls = rawEventUpdates['rawEvent.rawUrls']
    }
    if (updates.media !== undefined) {
      previousRaw.rawMedia = currentRaw.rawMedia
      newRaw.rawMedia = rawEventUpdates['rawEvent.rawMedia']
    }
    const rawEvent = doc.rawEvent as Record<string, unknown> | undefined
    const publisherIdStr = rawEvent?.publisherId ?? (rawEvent?.publisher as Record<string, unknown>)?.publisherId
    const waIdStr = (rawEvent?.publisher as Record<string, unknown>)?.waId
    await logEventEdit({
      eventId: id,
      changedFields,
      previous: { raw: previousRaw, final: previousFinal },
      new: { raw: newRaw, final: newFinal },
      ...(editSource !== undefined && { editSource }),
      publisherId: typeof publisherIdStr === 'string' ? publisherIdStr : undefined,
      waId: typeof waIdStr === 'string' ? waIdStr : undefined,
      correlationId,
    })
  }

  return { success: true, event: mergedEvent }
})

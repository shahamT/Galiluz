import { randomBytes } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { normalizePublisherFormattedEvent, validatePublisherFormattedEvent } from '~/server/utils/eventValidation'
import { sanitizeEventFields } from '~/server/utils/sanitizeEventFields'
import { logEventCreation } from '~/server/utils/eventLogs.service'
import { EVENT_CATEGORIES } from '~/consts/events.const.js'
import { CITIES } from '~/consts/regions.const.js'
import { convertOccurrenceTimes } from '~/server/utils/convertOccurrenceTimes'

const VALID_CATEGORY_IDS = Object.keys(EVENT_CATEGORIES)

/** Resolve a location's cityType, trusting the client value but deriving from CITIES as a fallback. */
function resolveCityType(loc: Record<string, unknown>): 'listed' | 'custom' {
  if (loc.cityType === 'listed' || loc.cityType === 'custom') return loc.cityType
  return CITIES[String(loc.city || '') as keyof typeof CITIES] ? 'listed' : 'custom'
}

export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)
  const body = await readBody<Record<string, unknown>>(event)

  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: 'request body required' })
  }

  // Sanitize all user text fields
  sanitizeEventFields(body)

  const loc = (body.location as Record<string, unknown>) || {}
  const occurrences = convertOccurrenceTimes(Array.isArray(body.occurrences) ? body.occurrences : [])

  // Build the event object in the expected shape
  const allCategories = Array.from(new Set([
    ...(typeof body.mainCategory === 'string' ? [body.mainCategory] : []),
    ...(Array.isArray(body.categories) ? body.categories.filter((c: unknown) => typeof c === 'string') : []),
  ]))

  const eventObj: Record<string, unknown> = {
    Title:            String(body.title || '').trim(),
    shortDescription: String(body.shortDescription || '').trim(),
    fullDescription:  String(body.fullDescription || '').trim(),
    mainCategory:     String(body.mainCategory || ''),
    categories:       allCategories,
    multiDayEvent:    body.multiDayEvent !== false,
    occurrences,
    location: {
      city:            String(loc.city || ''),
      cityType:        resolveCityType(loc),
      region:          typeof loc.region === 'string' && loc.region.trim() ? loc.region.trim() : undefined,
      locationName:    String(loc.locationName || ''),
      addressLine1:    String(loc.addressLine1 || ''),
      locationDetails: String(loc.locationNotes || ''),
      wazeNavLink:     loc.wazeNavLink || null,
      gmapsNavLink:    loc.gmapsNavLink || null,
    },
    price:       body.price !== undefined ? (body.price === null ? null : Number(body.price)) : null,
    urls:        Array.isArray(body.urls) ? body.urls : [],
    media:       Array.isArray(body.media) ? body.media : [],
    publisherId: session.publisherId,
    publisherPhone: '',
  }

  normalizePublisherFormattedEvent(eventObj, VALID_CATEGORY_IDS)

  const validation = validatePublisherFormattedEvent(eventObj)
  if (!validation.valid) {
    console.error('[publisher/events.post] validation failed:', validation.reason, JSON.stringify({ title: eventObj.Title, categories: eventObj.categories, mainCategory: eventObj.mainCategory, location: eventObj.location, occurrences: eventObj.occurrences }))
    throw createError({ statusCode: 422, message: validation.reason || 'שגיאת אימות' })
  }

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const col = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')
  const correlationId = randomBytes(4).toString('hex')

  const doc = {
    createdAt: new Date(),
    isActive:  false,
    event:     eventObj,
    rawEvent:  { publisherId: session.publisherId, source: 'publisher_portal' },
  }

  const result = await col.insertOne(doc)
  const eventId = result.insertedId.toString()

  await logEventCreation({
    eventId,
    action:      'event_created',
    title:       String(eventObj.Title),
    publisherId: session.publisherId,
    waId:        session.waId,
    correlationId,
  })

  return { id: eventId, success: true }
})

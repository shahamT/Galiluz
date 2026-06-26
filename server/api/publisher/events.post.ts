import { randomBytes } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { normalizePublisherFormattedEvent, validatePublisherFormattedEvent } from '~/server/utils/eventValidation'
import { sanitizeEventFields } from '~/server/utils/sanitizeEventFields'
import { logEventCreation } from '~/server/utils/eventLogs.service'
import { normalizeIsraeliPhone } from '~/server/utils/israeliPhone'
import { resolveExposedContactPhone } from '~/server/utils/contactPhone'
import { ensureAccountForPublisher } from '~/server/utils/accountScope'
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

  // Manager override: allow assigning the event to a different publisher
  const onBehalfPublisherId = typeof body.onBehalfPublisherId === 'string' ? body.onBehalfPublisherId.trim() : ''
  const onBehalfPhone        = typeof body.onBehalfPhone === 'string' ? body.onBehalfPhone.trim() : ''
  let effectivePublisherId   = session.publisherId
  let effectiveWaId          = session.waId // publisher's WhatsApp number → event.publisherPhone (public contact link)
  // Tenant key that OWNS the event: self → the caller's active account; on-behalf → the TARGET
  // publisher's account (created on the fly for a brand-new ghost).
  let effectiveAccountId     = session.activeAccountId || session.accountId || ''
  let isManagerAction        = false

  if (onBehalfPublisherId || onBehalfPhone) {
    if (!session.isSuperAdmin) throw createError({ statusCode: 403, message: 'אין הרשאה' })
    isManagerAction = true

    if (onBehalfPublisherId) {
      if (!ObjectId.isValid(onBehalfPublisherId))
        throw createError({ statusCode: 400, message: 'מזהה מפרסם לא תקין' })
      effectivePublisherId = onBehalfPublisherId
      // Resolve the target publisher's waId (contact link) + account (tenant key).
      const config2 = useRuntimeConfig() as Record<string, string>
      const { db: db2 } = await getMongoConnection()
      const target = await db2
        .collection(config2.mongodbCollectionPublishers || 'publishers')
        .findOne({ _id: new ObjectId(onBehalfPublisherId) }, { projection: { waId: 1, accountId: 1, accountName: 1 } })
      effectiveWaId = typeof target?.waId === 'string' ? target.waId : ''
      effectiveAccountId = await ensureAccountForPublisher({ _id: new ObjectId(onBehalfPublisherId), accountId: target?.accountId, accountName: target?.accountName, waId: target?.waId })
    } else {
      const normalized = normalizeIsraeliPhone(onBehalfPhone)
      if (!normalized) throw createError({ statusCode: 400, message: 'מספר טלפון לא תקין' })
      effectiveWaId = normalized

      const config2 = useRuntimeConfig() as Record<string, string>
      const { db: db2 } = await getMongoConnection()
      const publishersCol = db2.collection(config2.mongodbCollectionPublishers || 'publishers')
      const existing = await publishersCol.findOne({ waId: normalized })
      if (existing) {
        effectivePublisherId = existing._id.toString()
        effectiveAccountId = await ensureAccountForPublisher({ _id: existing._id, accountId: existing.accountId, accountName: existing.accountName, waId: existing.waId })
      } else {
        const ghostResult = await publishersCol.insertOne({
          waId: normalized,
          phone: normalized,
          status: 'ghost',
          type: 'publisher',
          createdOnBehalf: true,
          createdAt: new Date(),
        })
        effectivePublisherId = ghostResult.insertedId.toString()
        // New ghost → give it its own account + owner membership so the event is tenanted.
        effectiveAccountId = await ensureAccountForPublisher({ _id: ghostResult.insertedId, waId: normalized })
      }
    }
  }

  const loc = (body.location as Record<string, unknown>) || {}
  const occurrences = convertOccurrenceTimes(Array.isArray(body.occurrences) ? body.occurrences : [])

  // Contact-number controls: show/hide + optional custom number (validated to a wa.me-valid
  // Israeli number). The exposed publisherPhone is derived from these (see contactPhone util).
  const showContactPhone = body.showContactPhone !== false
  let customContactPhone = ''
  if (showContactPhone && typeof body.customContactPhone === 'string' && body.customContactPhone.trim()) {
    const normalized = normalizeIsraeliPhone(body.customContactPhone)
    if (!normalized) throw createError({ statusCode: 400, message: 'מספר טלפון לא תקין' })
    customContactPhone = normalized
  }

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
    accountId:   effectiveAccountId,
    publisherId: effectivePublisherId,
    originalCreatorPublisherId: effectivePublisherId,
    showContactPhone,
    customContactPhone,
    publisherPhone: resolveExposedContactPhone({ showContactPhone, customContactPhone, ownWaId: effectiveWaId }),
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
    rawEvent:  {
      publisherId: effectivePublisherId,
      source: 'publisher_portal',
      ...(isManagerAction && {
        isManagerAction: true,
        actingManagerPublisherId: session.publisherId,
        actingManagerWaId: session.waId,
      }),
    },
  }

  const result = await col.insertOne(doc)
  const eventId = result.insertedId.toString()

  await logEventCreation({
    eventId,
    action:      'event_created',
    title:       String(eventObj.Title),
    publisherId: effectivePublisherId,
    waId:        session.waId,
    correlationId,
  })

  return { id: eventId, success: true }
})

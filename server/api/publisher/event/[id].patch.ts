import { randomBytes } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { normalizePublisherFormattedEvent, validatePublisherFormattedEvent } from '~/server/utils/eventValidation'
import { sanitizeEventFields } from '~/server/utils/sanitizeEventFields'
import { logEventEdit } from '~/server/utils/eventLogs.service'
import { EVENT_CATEGORIES } from '~/consts/events.const.js'
import { convertOccurrenceTimes } from '~/server/utils/convertOccurrenceTimes'

const VALID_CATEGORY_IDS = Object.keys(EVENT_CATEGORIES)
const TRACKABLE_FIELDS = ['Title', 'shortDescription', 'fullDescription', 'categories', 'mainCategory', 'occurrences', 'location', 'price', 'urls', 'media', 'multiDayEvent']

export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id required' })

  let objectId: ObjectId
  try { objectId = new ObjectId(id) }
  catch { throw createError({ statusCode: 400, message: 'invalid id' }) }

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const col = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')

  const doc = await col.findOne({ _id: objectId })
  if (!doc || doc.deletedAt) throw createError({ statusCode: 404, message: 'event not found' })

  // Ownership check
  if (session.type !== 'manager' && doc.event?.publisherId !== session.publisherId) {
    throw createError({ statusCode: 403, message: 'forbidden' })
  }

  const body = await readBody<Record<string, unknown>>(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: 'request body required' })
  }

  sanitizeEventFields(body)

  // Start with existing event, merge updates
  const existing = { ...(doc.event || {}) } as Record<string, unknown>
  const loc = (body.location as Record<string, unknown>) || null

  const updates: Record<string, unknown> = {}

  if (typeof body.title === 'string')            updates.Title            = body.title.trim()
  if (typeof body.shortDescription === 'string') updates.shortDescription = body.shortDescription.trim()
  if (typeof body.fullDescription === 'string')  updates.fullDescription  = body.fullDescription.trim()
  if (typeof body.mainCategory === 'string')     updates.mainCategory     = body.mainCategory
  if (typeof body.multiDayEvent === 'boolean')   updates.multiDayEvent    = body.multiDayEvent
  if (body.price !== undefined)                  updates.price            = body.price === null ? null : Number(body.price)
  if (Array.isArray(body.urls))                  updates.urls             = body.urls
  if (Array.isArray(body.media))                 updates.media            = body.media

  if (Array.isArray(body.categories) || typeof body.mainCategory === 'string') {
    const main = String(updates.mainCategory ?? existing.mainCategory ?? '')
    const extra = Array.isArray(body.categories) ? body.categories.filter((c: unknown) => typeof c === 'string') : (existing.categories as string[] || [])
    updates.categories = Array.from(new Set([main, ...extra].filter(Boolean))).filter(c => VALID_CATEGORY_IDS.includes(c as string))
  }

  if (Array.isArray(body.occurrences)) {
    updates.occurrences = convertOccurrenceTimes(body.occurrences)
  }

  if (loc) {
    const existingLoc = (existing.location as Record<string, unknown>) || {}
    updates.location = {
      city:            String(loc.city ?? existingLoc.city ?? ''),
      locationName:    String(loc.locationName ?? existingLoc.locationName ?? ''),
      addressLine1:    String(loc.addressLine1 ?? existingLoc.addressLine1 ?? ''),
      locationDetails: String(loc.locationNotes ?? existingLoc.locationDetails ?? ''),
      wazeNavLink:     loc.wazeNavLink !== undefined ? (loc.wazeNavLink || null) : existingLoc.wazeNavLink,
      gmapsNavLink:    loc.gmapsNavLink !== undefined ? (loc.gmapsNavLink || null) : existingLoc.gmapsNavLink,
    }
  }

  // Detect changed fields for audit log
  const changedFields = TRACKABLE_FIELDS.filter(f => f in updates && JSON.stringify(updates[f]) !== JSON.stringify(existing[f]))

  // Merge into existing
  const merged = { ...existing, ...updates }

  normalizePublisherFormattedEvent(merged, VALID_CATEGORY_IDS)

  const validation = validatePublisherFormattedEvent(merged)
  if (!validation.valid) {
    throw createError({ statusCode: 422, message: validation.reason || 'שגיאת אימות' })
  }

  const correlationId = randomBytes(4).toString('hex')

  await col.updateOne({ _id: objectId }, { $set: { event: merged } })

  if (changedFields.length > 0) {
    await logEventEdit({
      eventId: id,
      changedFields,
      previous: { raw: existing, final: existing as Record<string, unknown> },
      new:      { raw: updates,  final: merged },
      editSource: 'publisher_portal',
      publisherId: session.publisherId,
      waId: session.waId,
      correlationId,
      isManagerAction: session.type === 'manager' && doc.event?.publisherId !== session.publisherId,
    })
  }

  return { success: true }
})

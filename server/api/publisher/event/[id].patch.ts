import { randomBytes } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { ownsEventForSession } from '~/server/utils/accountScope'
import { normalizePublisherFormattedEvent, validatePublisherFormattedEvent } from '~/server/utils/eventValidation'
import { sanitizeEventFields } from '~/server/utils/sanitizeEventFields'
import { logEventEdit } from '~/server/utils/eventLogs.service'
import { normalizeIsraeliPhone } from '~/server/utils/israeliPhone'
import { resolveExposedContactPhone } from '~/server/utils/contactPhone'
import { EVENT_CATEGORIES } from '~/consts/events.const.js'
import { CITIES } from '~/consts/regions.const.js'
import { convertOccurrenceTimes } from '~/server/utils/convertOccurrenceTimes'

const VALID_CATEGORY_IDS = Object.keys(EVENT_CATEGORIES)
const TRACKABLE_FIELDS = ['Title', 'shortDescription', 'fullDescription', 'categories', 'mainCategory', 'occurrences', 'location', 'price', 'urls', 'media', 'multiDayEvent', 'showContactPhone', 'customContactPhone']

/** Resolve cityType, trusting the incoming value, then the existing one, then deriving from CITIES. */
function resolveCityType(loc: Record<string, unknown>, existingLoc: Record<string, unknown>): 'listed' | 'custom' {
  if (loc.cityType === 'listed' || loc.cityType === 'custom') return loc.cityType
  if (existingLoc.cityType === 'listed' || existingLoc.cityType === 'custom') return existingLoc.cityType
  return CITIES[String(loc.city ?? existingLoc.city ?? '') as keyof typeof CITIES] ? 'listed' : 'custom'
}

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

  // Ownership check (tenant-scoped: the caller's active account owns the event, by event.accountId)
  const ownsEvent = await ownsEventForSession(session, doc.event)
  if (!session.isSuperAdmin && !ownsEvent) {
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
  if (typeof body.showContactPhone === 'boolean') updates.showContactPhone = body.showContactPhone
  if (typeof body.customContactPhone === 'string') {
    const raw = body.customContactPhone.trim()
    if (!raw) {
      updates.customContactPhone = ''
    } else {
      const normalized = normalizeIsraeliPhone(raw)
      if (!normalized) throw createError({ statusCode: 400, message: 'מספר טלפון לא תקין' })
      updates.customContactPhone = normalized
    }
  }

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
    const cityType = resolveCityType(loc, existingLoc)
    // region only for custom cities (listed derives it from CITIES on read); keep it
    // tied to cityType so switching listed<->custom on edit doesn't leave a stale region.
    const region = cityType === 'custom'
      ? (typeof loc.region === 'string' && loc.region.trim()
          ? loc.region.trim()
          : (typeof existingLoc.region === 'string' && existingLoc.region.trim() ? existingLoc.region.trim() : undefined))
      : undefined
    updates.location = {
      city:            String(loc.city ?? existingLoc.city ?? ''),
      cityType,
      region,
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

  // Re-derive the exposed contact number when the contact intent changed (handles
  // switching own↔custom↔hidden). 'own' needs the event publisher's current waId.
  if ('showContactPhone' in updates || 'customContactPhone' in updates) {
    let ownWaId = ''
    if (typeof merged.publisherId === 'string' && ObjectId.isValid(merged.publisherId)) {
      const pub = await db.collection(config.mongodbCollectionPublishers || 'publishers')
        .findOne({ _id: new ObjectId(merged.publisherId) }, { projection: { waId: 1 } })
      ownWaId = typeof pub?.waId === 'string' ? pub.waId : ''
    }
    merged.publisherPhone = resolveExposedContactPhone({
      showContactPhone: merged.showContactPhone,
      customContactPhone: merged.customContactPhone,
      ownWaId,
    })
  }

  const correlationId = randomBytes(4).toString('hex')

  // Stamp updatedAt on every edit — the "publisher touched this" signal that (with
  // status/transfer) keeps the crawler cleanup from deleting a worked-on draft. A content
  // change also clears approverNotifiedAt: the approver reviewed a now-stale version, so
  // the NEXT time this event is published (draft → active) they get notified again. No
  // notification fires here — only the flag is reset. (A plain re-publish of an unchanged
  // event keeps the flag set and stays silent.)
  const hadChanges = changedFields.length > 0
  await col.updateOne(
    { _id: objectId },
    {
      $set: { event: merged, updatedAt: new Date() },
      ...(hadChanges ? { $unset: { approverNotifiedAt: '' } } : {}),
    },
  )

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
      isManagerAction: session.isSuperAdmin && !ownsEvent,
    })
  }

  return { success: true }
})

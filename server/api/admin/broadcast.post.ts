import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { NOT_DELETED } from '~/server/utils/eventsQuery'

// Personalization tags — MUST match the gateway (apps/wa-gateway/src/routes/broadcast.js).
// The gateway does the per-recipient replacement; the web only renders here to validate
// the worst-case caption length against WhatsApp's limit.
const TAG_ACCOUNT = '<שם החשבון>'
const TAG_PUBLISHER = '<שם המפרסם>'
const MAX_CAPTION = 1024 // WhatsApp image-caption limit

function renderMessage(template: string, accountName: string, fullName: string): string {
  const account = accountName || fullName || ''
  const publisher = fullName || accountName || ''
  return template.split(TAG_ACCOUNT).join(account).split(TAG_PUBLISHER).join(publisher)
}

/**
 * POST /api/admin/broadcast (manager-only) — send a WhatsApp message (optional image +
 * formatted text with personalization tags) to selected APPROVED publishers via the
 * gateway, which paces the sends. Returns immediately with the queued count.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requireManager: true })

  const body = await readBody<{ publisherIds?: unknown; message?: unknown; imageUrl?: unknown }>(event)
  const publisherIds = Array.isArray(body?.publisherIds)
    ? (body.publisherIds as unknown[]).filter((x): x is string => typeof x === 'string' && ObjectId.isValid(x))
    : []
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : ''

  if (!publisherIds.length) throw createError({ statusCode: 400, message: 'יש לבחור לפחות מפרסם אחד' })
  if (!message && !imageUrl) throw createError({ statusCode: 400, message: 'יש להזין הודעה או לצרף תמונה' })
  // Only ever broadcast our own Cloudinary-hosted image (the URL is handed to Green API).
  if (imageUrl && !/^https:\/\/res\.cloudinary\.com\//.test(imageUrl)) {
    throw createError({ statusCode: 400, message: 'תמונה לא תקינה' })
  }

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const accountsCol = db.collection(config.mongodbCollectionAccounts || 'accounts')
  const publishersCol = db.collection(config.mongodbCollectionPublishers || 'publishers')

  // Defensive: only approved, non-deleted publishers among the selected ids ever get messaged.
  const docs = await publishersCol
    .find(
      { ...NOT_DELETED, _id: { $in: publisherIds.map((id) => new ObjectId(id)) }, status: 'approved' },
      { projection: { _id: 1, waId: 1, fullName: 1, accountId: 1, accountName: 1 } },
    )
    .toArray()

  // Resolve account titles for the account tag (same resolution as publishers.get.ts).
  const accountIds = [...new Set(docs.map((d) => d.accountId).filter(Boolean) as string[])].filter((id) => ObjectId.isValid(id))
  const accountDocs = accountIds.length
    ? await accountsCol.find({ _id: { $in: accountIds.map((id) => new ObjectId(id)) } }, { projection: { title: 1 } }).toArray()
    : []
  const accountTitleById = new Map<string, string>(accountDocs.map((a) => [a._id.toString(), a.title || '']))

  const recipients = docs
    .filter((d) => d.waId)
    .map((d) => ({
      id: d._id.toString(),
      phone: d.waId as string,
      accountName: d.accountId ? (accountTitleById.get(d.accountId) || '') : (d.accountName || ''),
      fullName: (d.fullName as string) || '',
    }))

  if (!recipients.length) throw createError({ statusCode: 422, message: 'לא נמצאו מפרסמים מאושרים לשליחה' })

  // When an image is attached, the rendered message is its caption — guard the worst case
  // so no recipient's send is rejected by WhatsApp's caption limit.
  if (imageUrl && message) {
    const longest = Math.max(...recipients.map((r) => renderMessage(message, r.accountName, r.fullName).length))
    if (longest > MAX_CAPTION) {
      throw createError({ statusCode: 400, message: `ההודעה ארוכה מדי לשליחה עם תמונה (מקסימום ${MAX_CAPTION} תווים)` })
    }
  }

  const gatewayUrl = (config.waGatewayUrl || process.env.WA_GATEWAY_URL || '').replace(/\/$/, '')
  const apiSecret = config.apiSecret || process.env.API_SECRET || ''
  if (!gatewayUrl) throw createError({ statusCode: 503, message: 'שירות ההודעות אינו זמין' })

  // Durable record + live-progress job doc, created up front (status 'sending'). The gateway
  // reports per-message progress back to /api/internal/broadcast-progress, which updates it.
  const now = new Date()
  const { insertedId } = await db.collection('broadcasts').insertOne({
    createdBy: session.publisherId,
    createdByName: session.fullName || '',
    recipientIds: recipients.map((r) => r.id),
    recipientCount: recipients.length,
    messageTemplate: message,
    hasImage: !!imageUrl,
    imageUrl: imageUrl || null,
    status: 'sending',
    sentCount: 0,
    failedIds: [] as string[],
    createdAt: now,
    updatedAt: now,
  })
  const broadcastId = insertedId.toString()

  // Hand the job to the always-on gateway (it responds 202 and paces the sends in the
  // background). Compact payload: template + per-recipient {id, name fields}; gateway renders tags.
  try {
    await $fetch(`${gatewayUrl}/internal/broadcast`, {
      method: 'POST',
      headers: { 'x-api-secret': apiSecret },
      body: { broadcastId, recipients, message, imageUrl: imageUrl || undefined, fileName: 'broadcast.jpg' },
      timeout: 20000,
    })
  } catch (err) {
    console.error('[admin/broadcast] gateway dispatch failed:', err instanceof Error ? err.message : String(err))
    await db.collection('broadcasts').updateOne({ _id: insertedId }, { $set: { status: 'failed', updatedAt: new Date() } }).catch(() => {})
    throw createError({ statusCode: 502, message: 'שליחת ההודעות נכשלה' })
  }

  return { success: true, broadcastId, total: recipients.length }
})

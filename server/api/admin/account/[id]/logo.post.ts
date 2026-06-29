import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { NOT_DELETED } from '~/server/utils/eventsQuery'
import { uploadBufferToCloudinary } from '~/server/utils/cloudinary'

// Account logo (future-use branding). Images only, ≤2 MB. Gated like account edit.
const MAX_SIZE = 2 * 1024 * 1024
const ALLOWED_MIMETYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

function validateMagicBytes(buf: Buffer): boolean {
  if (buf.length < 12) return false
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true // JPEG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true // PNG
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true // WebP
  return false
}

export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event, { requirePlatformStaff: true })

  const id = getRouterParam(event, 'id')
  if (!id || !ObjectId.isValid(id)) throw createError({ statusCode: 400, message: 'invalid id' })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const accountsCol = db.collection(config.mongodbCollectionAccounts || 'accounts')

  const account = await accountsCol.findOne({ _id: new ObjectId(id), ...NOT_DELETED }, { projection: { kind: 1 } })
  if (!account) throw createError({ statusCode: 404, message: 'account not found' })
  const isPlatform = account.kind === 'platform'
  if (isPlatform && !session.isPlatformOwner) throw createError({ statusCode: 403, message: 'platform_owner_only' })
  if (!isPlatform && !session.isSuperAdmin) throw createError({ statusCode: 403, message: 'manager_only' })

  const body = await readBody<{ file?: string; mimetype?: string; filename?: string }>(event)
  const base64 = typeof body?.file === 'string' ? body.file : ''
  const mimetype = typeof body?.mimetype === 'string' ? body.mimetype.trim().toLowerCase() : ''
  const filename = typeof body?.filename === 'string' ? (body.filename.trim() || 'logo') : 'logo'
  if (!base64) throw createError({ statusCode: 400, message: 'file (base64) is required' })
  if (!ALLOWED_MIMETYPES.has(mimetype)) throw createError({ statusCode: 400, message: 'סוג קובץ לא נתמך (רק JPG, PNG, WebP)' })

  let buffer: Buffer
  try { buffer = Buffer.from(base64, 'base64') } catch { throw createError({ statusCode: 400, message: 'base64 לא תקין' }) }
  if (buffer.length > MAX_SIZE) throw createError({ statusCode: 400, message: 'הלוגו גדול מ-2MB' })
  if (!validateMagicBytes(buffer)) throw createError({ statusCode: 400, message: 'תוכן הקובץ אינו תואם לסוגו' })

  const { cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret } = config
  if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
    throw createError({ statusCode: 503, message: 'Cloudinary not configured' })
  }

  const result = await uploadBufferToCloudinary(buffer, filename, mimetype, 'account-logos', cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret)
  if (!result) throw createError({ statusCode: 500, message: 'Upload failed' })

  const logo = result.secure_url || result.url
  await accountsCol.updateOne({ _id: new ObjectId(id) }, { $set: { logo, updatedAt: new Date() } })
  return { logo }
})

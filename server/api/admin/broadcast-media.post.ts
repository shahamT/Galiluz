import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { uploadBufferToCloudinary } from '~/server/utils/cloudinary'

// WhatsApp image broadcast: tighter than the publisher media endpoint — images only, ≤5 MB
// (WhatsApp's image limit). Manager-gated (only managers reach the broadcast page).
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIMETYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp'])

function validateMagicBytes(buf: Buffer, _mimetype: string): boolean {
  if (buf.length < 12) return false
  // JPEG
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true
  // WebP: RIFF....WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true
  return false
}

export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requireManager: true })

  const body = await readBody<{ file: string; mimetype: string; filename: string }>(event)
  const base64 = typeof body?.file === 'string' ? body.file : ''
  const mimetype = typeof body?.mimetype === 'string' ? body.mimetype.trim().toLowerCase() : ''
  const filename = typeof body?.filename === 'string' ? (body.filename.trim() || 'image') : 'image'

  if (!base64) throw createError({ statusCode: 400, message: 'file (base64) is required' })
  if (!ALLOWED_MIMETYPES.has(mimetype)) throw createError({ statusCode: 400, message: 'סוג קובץ לא נתמך (רק JPG, PNG, WebP)' })

  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXTENSIONS.has(ext)) throw createError({ statusCode: 400, message: 'סיומת קובץ לא מותרת' })

  let buffer: Buffer
  try { buffer = Buffer.from(base64, 'base64') }
  catch { throw createError({ statusCode: 400, message: 'base64 לא תקין' }) }

  if (buffer.length > MAX_SIZE) throw createError({ statusCode: 400, message: 'התמונה גדולה מ-5MB' })
  if (!validateMagicBytes(buffer, mimetype)) throw createError({ statusCode: 400, message: 'תוכן הקובץ אינו תואם לסוגו' })

  const config = useRuntimeConfig()
  const { cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret } = config as Record<string, string>
  if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
    throw createError({ statusCode: 503, message: 'Cloudinary not configured' })
  }

  const result = await uploadBufferToCloudinary(buffer, filename, mimetype, 'broadcasts', cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret)
  if (!result) throw createError({ statusCode: 500, message: 'Upload failed' })

  return { cloudinaryURL: result.secure_url || result.url }
})

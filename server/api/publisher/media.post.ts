import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { uploadBufferToCloudinary } from '~/server/utils/cloudinary'
import { checkRateLimit } from '~/server/utils/rateLimit'

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB

const ALLOWED_MIMETYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
  'video/webm', 'video/m4v',
])

const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif',
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v',
])

function validateMagicBytes(buf: Buffer, mimetype: string): boolean {
  if (mimetype.startsWith('video/') || mimetype === 'image/heic' || mimetype === 'image/heif') return true
  if (buf.length < 12) return false
  // JPEG
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true
  // WebP: RIFF....WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true
  return false
}

export default defineEventHandler(async (event) => {
  await checkRateLimit(event)
  await requirePublisherAuth(event)

  const body = await readBody<{ file: string; mimetype: string; filename: string }>(event)

  const base64   = typeof body?.file === 'string' ? body.file : ''
  const mimetype = typeof body?.mimetype === 'string' ? body.mimetype.trim().toLowerCase() : ''
  const filename = typeof body?.filename === 'string' ? body.filename.trim() || 'file' : 'file'

  if (!base64)    throw createError({ statusCode: 400, message: 'file (base64) is required' })
  if (!mimetype)  throw createError({ statusCode: 400, message: 'mimetype is required' })

  // Validate MIME type
  if (!ALLOWED_MIMETYPES.has(mimetype)) {
    throw createError({ statusCode: 400, message: 'סוג קובץ לא נתמך' })
  }

  // Validate extension
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw createError({ statusCode: 400, message: 'סיומת קובץ לא מותרת' })
  }

  // Reject double-extension tricks (e.g. malware.php.jpg)
  const parts = filename.split('.')
  if (parts.length > 2) {
    const dangerous = ['php', 'js', 'exe', 'sh', 'bat', 'cmd', 'py', 'rb', 'pl', 'asp', 'aspx']
    if (dangerous.includes(parts[parts.length - 2].toLowerCase())) {
      throw createError({ statusCode: 400, message: 'שם קובץ לא תקין' })
    }
  }

  // Decode base64 → buffer
  let buffer: Buffer
  try { buffer = Buffer.from(base64, 'base64') }
  catch { throw createError({ statusCode: 400, message: 'base64 לא תקין' }) }

  // Validate size
  if (buffer.length > MAX_SIZE) {
    throw createError({ statusCode: 400, message: `הקובץ גדול מ-20MB` })
  }

  // Validate magic bytes
  if (!validateMagicBytes(buffer, mimetype)) {
    throw createError({ statusCode: 400, message: 'תוכן הקובץ אינו תואם לסוגו' })
  }

  const config = useRuntimeConfig()
  const { cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret } = config as Record<string, string>
  const folder = (config as any).cloudinaryFolder || 'publisher-events'

  if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
    throw createError({ statusCode: 503, message: 'Cloudinary not configured' })
  }

  const result = await uploadBufferToCloudinary(buffer, filename, mimetype, folder, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret)
  if (!result) throw createError({ statusCode: 500, message: 'Upload failed' })

  return {
    cloudinaryURL:  result.secure_url || result.url,
    cloudinaryData: result,
    isMain:         false,
  }
})

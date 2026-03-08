import { requireApiSecret } from '~/server/utils/requireApiSecret'
import { uploadBufferToCloudinary } from '~/server/utils/cloudinary'

interface UploadBody {
  file: string
  mimetype: string
  filename: string
}

/** Max base64 string length (~15 MB file after decoding). */
const MAX_BASE64_LENGTH = 20 * 1024 * 1024

export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const body = await readBody<UploadBody>(event)

  const base64 = typeof body?.file === 'string' ? body.file : ''
  const mimetype = typeof body?.mimetype === 'string' ? body.mimetype.trim() : 'application/octet-stream'
  const filename = typeof body?.filename === 'string' ? body.filename.trim() || 'file' : 'file'

  if (!base64) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'file (base64) is required',
    })
  }

  if (base64.length > MAX_BASE64_LENGTH) {
    throw createError({
      statusCode: 413,
      statusMessage: 'Payload Too Large',
      message: 'File exceeds maximum allowed size of ~15 MB',
    })
  }

  let buffer: Buffer
  try {
    buffer = Buffer.from(base64, 'base64')
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'file must be valid base64',
    })
  }

  const config = useRuntimeConfig()
  const cloudName = config.cloudinaryCloudName
  const apiKey = config.cloudinaryApiKey
  const apiSecret = config.cloudinaryApiSecret
  const folder = config.cloudinaryFolder || 'wa-bot-events'

  if (!cloudName || !apiKey || !apiSecret) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
      message: 'Cloudinary not configured',
    })
  }

  const result = await uploadBufferToCloudinary(
    buffer,
    filename,
    mimetype,
    folder,
    cloudName,
    apiKey,
    apiSecret,
  )

  if (!result) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Upload failed',
    })
  }

  return result
})

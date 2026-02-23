import { v2 as cloudinary } from 'cloudinary'

export interface CloudinaryUploadResult {
  url: string
  secure_url: string
  public_id: string
  format?: string
  width?: number
  height?: number
  bytes?: number
}

/**
 * Upload a buffer to Cloudinary. Uses runtime config for credentials.
 */
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  filename: string,
  mimetype: string,
  folder: string,
  cloudName: string,
  apiKey: string,
  apiSecret: string,
): Promise<CloudinaryUploadResult | null> {
  if (!cloudName || !apiKey || !apiSecret) {
    console.error('[Cloudinary] Missing configuration')
    return null
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  })

  let resourceType: 'image' | 'video' | 'raw' = 'raw'
  if (mimetype.startsWith('image/')) {
    resourceType = 'image'
  } else if (mimetype.startsWith('video/')) {
    resourceType = 'video'
  }

  const baseName = filename.replace(/\.[^/.]+$/, '') || 'file'
  const publicId = `${folder}/${baseName}-${Date.now()}`

  return new Promise((resolve) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder,
        public_id: publicId,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          console.error('[Cloudinary] Upload error:', error.message)
          resolve(null)
          return
        }
        if (!result) {
          resolve(null)
          return
        }
        resolve({
          url: result.url,
          secure_url: result.secure_url,
          public_id: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
        })
      },
    )
    uploadStream.end(buffer)
  })
}

import { destroyOnCloudinary } from '~/server/utils/cloudinary'

/**
 * Destroy all Cloudinary assets of a deleted event.
 * Best-effort: failures are logged and never block the delete flow,
 * but "deleted" media must not stay publicly reachable on the CDN.
 */
export async function deleteEventCloudinaryMedia(eventDoc: Record<string, any>, correlationId?: string) {
  const media = Array.isArray(eventDoc?.event?.media) ? eventDoc.event.media : []
  const items = media
    .map((m: any) => ({
      publicId: m?.cloudinaryData?.public_id as string | undefined,
      resourceType: (m?.cloudinaryData?.resource_type === 'video' ? 'video' : 'image') as 'image' | 'video',
    }))
    .filter((i: { publicId?: string }) => typeof i.publicId === 'string' && i.publicId.length > 0)

  if (items.length === 0) return

  const config = useRuntimeConfig() as Record<string, string>
  const { cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret } = config
  if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
    console.warn('[EventMedia] Cloudinary not configured — skipping media cleanup', correlationId || '')
    return
  }

  try {
    const results = await Promise.all(
      items.map((i: { publicId: string; resourceType: 'image' | 'video' }) =>
        destroyOnCloudinary(i.publicId, i.resourceType, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret),
      ),
    )
    const failed = results.filter((ok) => !ok).length
    if (failed > 0) {
      console.error(`[EventMedia] ${failed}/${items.length} Cloudinary deletions failed`, correlationId || '')
    }
  } catch (err) {
    console.error('[EventMedia] Media cleanup error:', err instanceof Error ? err.message : err, correlationId || '')
  }
}

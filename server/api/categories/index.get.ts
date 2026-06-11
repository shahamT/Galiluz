import { EVENT_CATEGORIES } from '~/server/consts/events.const'

export default defineEventHandler(async (event) => {
  try {
    // Static data — let clients and CDN cache for a day
    setHeader(event, 'Cache-Control', 'public, max-age=86400')
    return EVENT_CATEGORIES
  } catch (error: unknown) {
    console.error('[categories] Failed to fetch categories:', error instanceof Error ? error.message : String(error))
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch categories',
    })
  }
})

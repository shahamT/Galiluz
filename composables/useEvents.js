import { logger } from '~/utils/logger'
import { flattenEventsByOccurrence } from '~/utils/events.service'

const LOG_PREFIX = '[EventsAPI]'

export const useEvents = () => {
  // Fetch on server with API key; client uses cached payload so the secret is never sent to the browser.
  const config = useRuntimeConfig()
  const { data, pending, error, refresh } = useFetch('/api/events', {
    key: 'events',
    server: true,
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
    headers: import.meta.server ? { 'X-API-Key': config.apiSecret || '' } : {},
  })

  // Log on client side only
  if (import.meta.client) {
    // Log when fetching starts
    watch(pending, (isLoading) => {
      if (isLoading) {
        logger.info(LOG_PREFIX, 'Fetching events...')
      }
    })

    // Log when data is loaded (including empty array)
    watch(data, (events) => {
      if (events && Array.isArray(events)) {
        if (events.length > 0) {
          logger.info(LOG_PREFIX, `${events.length} events were fetched:`, events)
        }
        if (import.meta.DEV) {
          const flat = flattenEventsByOccurrence(events)
          logger.debug(LOG_PREFIX, 'Refactored events (flat):', flat)
        }
      }
    }, { immediate: true })

    // Log errors
    watch(error, (err) => {
      if (err) {
        logger.error(LOG_PREFIX, `Error: ${err.message || 'Failed to fetch events'}`)
      }
    })
  }

  const dataComputed = computed(() => {
    if (error.value && !data.value) {
      return []
    }
    const raw = data.value || []
    if (!Array.isArray(raw)) return []
    return flattenEventsByOccurrence(raw)
  })

  return {
    data: dataComputed,
    isLoading: pending,
    isError: computed(() => {
      return !!error.value && !data.value
    }),
    refresh,
  }
}

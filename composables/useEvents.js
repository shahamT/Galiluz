import { logger } from '~/utils/logger'
import { flattenEventsByOccurrence } from '~/utils/events.service'

const LOG_PREFIX = '[EventsAPI]'

/** Months ahead of the anchor month included in the events window. */
const WINDOW_MONTHS_AHEAD = 2

/** Month serial helpers: serial = year*12 + (month-1). */
const toSerial = (year, month) => year * 12 + (month - 1)
const fromSerial = (s) => ({ year: Math.floor(s / 12), month: (s % 12) + 1 })

/** Last day of a {year, month} as YYYY-MM-DD. */
function lastDayOfMonth({ year, month }) {
  const day = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Month targeted by the current route (daily ?date= or monthly ?year=&month=), if any. */
function monthFromRoute(route) {
  const d = typeof route.query?.date === 'string' ? route.query.date : ''
  if (/^\d{4}-\d{2}/.test(d)) return { year: parseInt(d.slice(0, 4)), month: parseInt(d.slice(5, 7)) }
  const y = parseInt(route.query?.year)
  const m = parseInt(route.query?.month)
  if (y > 2000 && m >= 1 && m <= 12) return { year: y, month: m }
  return null
}

export const useEvents = () => {
  // Fetch on server with API key; client uses cached payload so the secret is never sent to the browser.
  const config = useRuntimeConfig()
  const route = useRoute()

  // Rolling window: feed is bounded to [server cutoff .. end of windowEnd month].
  // Starts at current month + 2 (or the deep-linked month + 2 if further) and only
  // ever expands, so navigation never makes already-loaded events disappear.
  const windowEnd = useState('events-window-end', () => {
    const now = new Date()
    let serial = toSerial(now.getFullYear(), now.getMonth() + 1) + WINDOW_MONTHS_AHEAD
    const target = monthFromRoute(route)
    if (target) serial = Math.max(serial, toSerial(target.year, target.month) + WINDOW_MONTHS_AHEAD)
    return fromSerial(serial)
  })

  const fetchQuery = computed(() => ({ to: lastDayOfMonth(windowEnd.value) }))

  const { data, pending, error, refresh } = useFetch('/api/events', {
    key: 'events',
    server: true,
    query: fetchQuery,
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
    headers: import.meta.server ? { 'X-API-Key': config.apiSecret || '' } : {},
  })

  /** Expand the window when the user navigates to a month near/past its end. */
  const ensureMonthLoaded = (year, month) => {
    if (!year || !month) return
    const needed = toSerial(year, month) + WINDOW_MONTHS_AHEAD
    if (needed > toSerial(windowEnd.value.year, windowEnd.value.month)) {
      windowEnd.value = fromSerial(needed)
    }
  }

  // Log on client side only (dev only for info/debug; errors always)
  if (import.meta.client) {
    // Log when fetching starts
    watch(pending, (isLoading) => {
      if (isLoading && import.meta.dev) {
        logger.info(LOG_PREFIX, 'Fetching events...')
      }
    })

    // Log when data is loaded (including empty array)
    watch(data, (events) => {
      if (events && Array.isArray(events)) {
        if (events.length > 0 && import.meta.dev) {
          logger.info(LOG_PREFIX, `${events.length} events were fetched:`, events)
        }
        if (import.meta.dev) {
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
    ensureMonthLoaded,
  }
}

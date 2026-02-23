import { parseCategories, serializeCategories, parseTimeFilter, isValidMonthYear } from '~/utils/validation.helpers'
import {
  MINUTES_PER_DAY,
  FILTER_PREFERENCE_STORAGE_KEY,
  ROUTE_MONTHLY_VIEW,
  ROUTE_DAILY_VIEW,
} from '~/consts/calendar.const'
import { getTodayDateString } from '~/utils/date.helpers'

/**
 * Composable for syncing calendar state with URL query parameters
 * Monthly: ROUTE_MONTHLY_VIEW?year=...&month=... ; Daily: ROUTE_DAILY_VIEW?date=...
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.syncMonth - Whether to sync currentDate (year/month) to URL (monthly view only)
 * @returns {Object} - URL state management functions
 */
export const useUrlState = (options = {}) => {
  const { syncMonth = false } = options

  const route = useRoute()
  const router = useRouter()
  const calendarStore = useCalendarStore()
  const { selectedCategories, timeFilterStart, timeFilterEnd, timeFilterPreset, currentDate } = storeToRefs(calendarStore)

  const isInitialized = ref(false)

  /**
   * Parse URL query parameters and extract filter state
   * @param {Object} query - Route query object
   * @returns {Object} - Parsed filter state
   */
  const parseUrlParams = (query) => {
    const categories = parseCategories(query.categories)
    const timeRange = parseTimeFilter(query.timeStart, query.timeEnd)
    const preset = query.timePreset || null
    
    return {
      categories,
      timeStart: timeRange.start,
      timeEnd: timeRange.end,
      timePreset: preset,
    }
  }

  /**
   * Parse month/year from URL query parameters
   * @param {Object} query - Route query object
   * @returns {Object|null} - Parsed date or null if invalid
   */
  const parseMonthYearFromUrl = (query) => {
    const year = parseInt(query.year)
    const month = parseInt(query.month)
    
    if (year && month && isValidMonthYear(year, month)) {
      return { year, month }
    }
    
    return null
  }

  /**
   * Whether the route query contains any filter parameters (categories or time)
   */
  const hasFilterParamsInQuery = (query) => {
    return (
      'categories' in query ||
      'timeStart' in query ||
      'timeEnd' in query ||
      'timePreset' in query
    )
  }

  /**
   * Read filter preference from localStorage (client-only). Returns parsed filter state or null.
   */
  const readFilterPreference = () => {
    if (!import.meta.client) return null
    try {
      const raw = localStorage.getItem(FILTER_PREFERENCE_STORAGE_KEY)
      if (!raw) return null
      const stored = JSON.parse(raw)
      if (!stored || typeof stored !== 'object') return null
      const filters = parseUrlParams(stored)
      return filters
    } catch {
      return null
    }
  }

  /**
   * Save current store filter state to localStorage (client-only). Same shape as URL query.
   */
  const saveFilterPreference = () => {
    if (!import.meta.client) return
    try {
      const payload = {}
      const categoriesParam = serializeCategories(selectedCategories.value)
      if (categoriesParam) {
        payload.categories = categoriesParam
      }
      if (timeFilterStart.value !== 0 || timeFilterEnd.value !== MINUTES_PER_DAY) {
        payload.timeStart = timeFilterStart.value
        payload.timeEnd = timeFilterEnd.value
        if (timeFilterPreset.value) {
          payload.timePreset = timeFilterPreset.value
        }
      }
      localStorage.setItem(FILTER_PREFERENCE_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // ignore storage errors
    }
  }

  /**
   * Build query parameters from current store state (and preserve date on daily view)
   */
  const buildQueryParams = () => {
    const params = {}

    if (syncMonth && currentDate.value) {
      params.year = currentDate.value.year
      params.month = currentDate.value.month
    }

    if (!syncMonth && route.path === ROUTE_DAILY_VIEW) {
      params.date = route.query.date || getTodayDateString()
    }

    const categoriesParam = serializeCategories(selectedCategories.value)
    if (categoriesParam) {
      params.categories = categoriesParam
    }

    if (timeFilterStart.value !== 0 || timeFilterEnd.value !== MINUTES_PER_DAY) {
      params.timeStart = timeFilterStart.value
      params.timeEnd = timeFilterEnd.value
      if (timeFilterPreset.value) {
        params.timePreset = timeFilterPreset.value
      }
    }

    return params
  }

  /**
   * Update URL with current store state. Only runs when on the matching route.
   * Preserves event param so shareable event links (e.g. from wa-bot) are not stripped.
   */
  const updateUrl = () => {
    if (!isInitialized.value) return
    if (syncMonth && route.path !== ROUTE_MONTHLY_VIEW) return
    if (!syncMonth && route.path !== ROUTE_DAILY_VIEW) return

    const newQuery = buildQueryParams()
    if (route.query.event) {
      newQuery.event = route.query.event
    }
    const currentQuery = route.query
    const queryChanged = JSON.stringify(currentQuery) !== JSON.stringify(newQuery)

    if (queryChanged) {
      const path = syncMonth ? ROUTE_MONTHLY_VIEW : ROUTE_DAILY_VIEW
      router.replace({ path, query: newQuery })
    }
  }

  /**
   * Initialize store from URL parameters (or from localStorage when URL has no filter params)
   * Called once on mount before watchers are set up
   */
  const initializeFromUrl = () => {
    const query = route.query

    // Initialize month/year if syncing month and valid in URL
    if (syncMonth) {
      const dateFromUrl = parseMonthYearFromUrl(query)
      if (dateFromUrl) {
        calendarStore.setCurrentDate(dateFromUrl)
      }
    }

    // Filters: URL wins when it has filter params; otherwise apply saved preference
    if (hasFilterParamsInQuery(query)) {
      const filters = parseUrlParams(query)
      calendarStore.setFiltersFromUrl(
        filters.categories,
        filters.timeStart,
        filters.timeEnd,
        filters.timePreset
      )
      saveFilterPreference()
    } else {
      const filters = readFilterPreference()
      if (filters) {
        calendarStore.setFiltersFromUrl(
          filters.categories,
          filters.timeStart,
          filters.timeEnd,
          filters.timePreset
        )
      }
    }
  }

  /**
   * Start watching store and syncing to URL
   * Called after initialization to avoid double-navigation
   */
  const startUrlSync = () => {
    isInitialized.value = true
    updateUrl()

    // Watch filters and sync to URL and localStorage
    watch(
      () => [
        selectedCategories.value,
        timeFilterStart.value,
        timeFilterEnd.value,
        timeFilterPreset.value,
      ],
      () => {
        updateUrl()
        saveFilterPreference()
      },
      { deep: true }
    )
    
    // Watch currentDate if syncing month
    if (syncMonth) {
      watch(
        () => currentDate.value,
        () => {
          updateUrl()
        },
        { deep: true }
      )
    }
  }

  return {
    initializeFromUrl,
    startUrlSync,
  }
}

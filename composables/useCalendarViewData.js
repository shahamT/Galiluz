/**
 * Composable for getting events and categories data in calendar views
 * Handles both SSR (direct composable call) and CSR (plugin-provided data)
 * Centralizes loading and error state logic
 *
 * Plugin keys (from data-init.client.js): $eventsData, $categoriesData
 * On client: uses plugin-provided data to avoid duplicate fetches
 * On SSR: plugin does not run; falls back to useEvents/useCategories directly
 *
 * @returns {{ events: import('vue').ComputedRef<Array>, categories: import('vue').ComputedRef<Object>, isLoading: import('vue').ComputedRef<boolean>, isError: import('vue').ComputedRef<boolean> }}
 */
export const useCalendarViewData = () => {
  const nuxtApp = useNuxtApp()
  const eventsDataSource = nuxtApp.$eventsData || useEvents()
  const categoriesDataSource = nuxtApp.$categoriesData || useCategories()

  // Extract reactive refs
  const { data: events, isLoading: eventsLoading, isError: eventsError, ensureMonthLoaded } = eventsDataSource
  const {
    data: categories,
    isLoading: categoriesLoading,
    isError: categoriesError,
  } = categoriesDataSource

  // Combined loading and error states
  const isLoading = computed(() => unref(eventsLoading) || unref(categoriesLoading))
  const isError = computed(() => unref(eventsError) || unref(categoriesError))

  return {
    events,
    categories,
    isLoading,
    isError,
    /** Expand the events feed window to cover the given month (no-op when already covered). */
    ensureMonthLoaded: ensureMonthLoaded || (() => {}),
  }
}

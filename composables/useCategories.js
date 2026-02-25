import { logger } from '~/utils/logger'

const LOG_PREFIX = '[CategoriesAPI]'

export const useCategories = () => {
  const { data, pending, error, refresh } = useFetch('/api/categories', {
    key: 'categories',
    server: false,
  })

  if (import.meta.client) {
    watch(pending, (isLoading) => {
      if (isLoading && import.meta.dev) {
        logger.info(LOG_PREFIX, 'Fetching categories...')
      }
    })

    watch(data, (categories) => {
      if (categories && Object.keys(categories).length > 0 && import.meta.dev) {
        logger.info(LOG_PREFIX, `${Object.keys(categories).length} categories were fetched:`, categories)
      }
    })

    watch(error, (err) => {
      if (err) {
        logger.error(LOG_PREFIX, `Error: ${err.message || 'Failed to fetch categories'}`)
      }
    })
  }

  return {
    data: computed(() => {
      // Return empty object only when there's an error and no data
      if (error.value && !data.value) {
        return {}
      }
      return data.value || {}
    }),
    isLoading: pending,
    isError: computed(() => !!error.value && !data.value),
    refresh,
  }
}

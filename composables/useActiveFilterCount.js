import { MINUTES_PER_DAY } from '~/consts/calendar.const'

/**
 * Composable for computing active filter count and whether any filters are applied.
 * Used by FilterNotifyBar and filter-related UI.
 */
export function useActiveFilterCount() {
  const calendarStore = useCalendarStore()
  const { selectedCategories, selectedRegions, timeFilterStart, timeFilterEnd } = storeToRefs(calendarStore)

  const isTimeFilterActive = computed(() => {
    return timeFilterStart.value !== 0 || timeFilterEnd.value !== MINUTES_PER_DAY
  })

  const hasAnyFilter = computed(() => {
    return (
      (selectedCategories.value?.length ?? 0) > 0 ||
      (selectedRegions.value?.length ?? 0) > 0 ||
      isTimeFilterActive.value
    )
  })

  const activeFilterCount = computed(() => {
    let count = 0
    if ((selectedCategories.value?.length ?? 0) > 0) count += 1
    if ((selectedRegions.value?.length ?? 0) > 0) count += 1
    if (isTimeFilterActive.value) count += 1
    return count
  })

  return {
    hasAnyFilter,
    activeFilterCount,
  }
}

import { getCurrentYearMonth } from '~/utils/date.helpers'
import { MINUTES_PER_DAY, TIME_FILTER_PRESETS } from '~/consts/calendar.const'

/**
 * Shared view/filter state for both monthly and daily views:
 * category filter (selectedCategories), time filter (timeFilterStart/End), and selected month (currentDate).
 */

export const useCalendarStore = defineStore('calendar', () => {
  const selectedCategories = ref([])
  const selectedRegions = ref([])
  const currentDate = ref(getCurrentYearMonth())
  const timeFilterStart = ref(0)
  const timeFilterEnd = ref(MINUTES_PER_DAY)
  const timeFilterPreset = ref(null)
  /** Last date (YYYY-MM-DD) the user viewed in daily view; used when switching back to daily from monthly */
  const lastDailyViewDate = ref(null)

  function toggleCategory(categoryId) {
    const index = selectedCategories.value.indexOf(categoryId)
    if (index > -1) {
      selectedCategories.value.splice(index, 1)
    } else {
      selectedCategories.value.push(categoryId)
    }
  }

  function toggleRegion(regionKey) {
    const index = selectedRegions.value.indexOf(regionKey)
    if (index > -1) {
      selectedRegions.value.splice(index, 1)
    } else {
      selectedRegions.value.push(regionKey)
    }
  }

  function setSelectedRegions(regions) {
    selectedRegions.value = Array.isArray(regions) ? [...regions] : []
  }

  function resetFilter() {
    selectedCategories.value = []
    selectedRegions.value = []
    timeFilterStart.value = 0
    timeFilterEnd.value = MINUTES_PER_DAY
    timeFilterPreset.value = null
  }

  function setTimeRange(startMinutes, endMinutes) {
    const start = Math.max(0, Math.min(MINUTES_PER_DAY, Math.min(startMinutes, endMinutes)))
    const end = Math.max(0, Math.min(MINUTES_PER_DAY, Math.max(startMinutes, endMinutes)))
    timeFilterStart.value = start
    timeFilterEnd.value = end
  }

  function setTimePreset(presetId) {
    const preset = TIME_FILTER_PRESETS.find((p) => p.id === presetId)
    if (preset) {
      timeFilterStart.value = preset.startMinutes
      timeFilterEnd.value = preset.endMinutes
      timeFilterPreset.value = presetId
    }
  }

  function clearTimePreset() {
    timeFilterPreset.value = null
  }

  function setCurrentDate(date) {
    currentDate.value = date
  }

  function setLastDailyViewDate(dateString) {
    lastDailyViewDate.value = dateString || null
  }

  function setFiltersFromUrl(categories, timeStart, timeEnd, timePreset, regions) {
    selectedCategories.value = categories || []
    selectedRegions.value = regions || []
    timeFilterStart.value = timeStart ?? 0
    timeFilterEnd.value = timeEnd ?? MINUTES_PER_DAY
    timeFilterPreset.value = timePreset || null
  }

  return {
    selectedCategories,
    selectedRegions,
    currentDate,
    timeFilterStart,
    timeFilterEnd,
    timeFilterPreset,
    lastDailyViewDate,
    toggleCategory,
    toggleRegion,
    setSelectedRegions,
    resetFilter,
    setTimeRange,
    setTimePreset,
    clearTimePreset,
    setCurrentDate,
    setLastDailyViewDate,
    setFiltersFromUrl,
  }
})

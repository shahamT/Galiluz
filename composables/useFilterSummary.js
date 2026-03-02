import { UI_TEXT, MINUTES_PER_DAY } from '~/consts/calendar.const'
import { EVENT_CATEGORIES } from '~/consts/events.const'
import { REGIONS } from '~/consts/regions.const'

import { formatMinutesToTime } from '~/utils/date.helpers'

/**
 * Computes the filter summary string as shown on the filter button.
 * Single source of truth for both CalendarViewHeader filter button and FilterNotifyBar.
 * @param {Object|import('vue').Ref<Object>} categories - Categories map from useCalendarViewData
 * @returns {{ filterSummary: import('vue').ComputedRef<string>, filterButtonLabel: import('vue').ComputedRef<string> }}
 */
export function useFilterSummary(categories) {
  const calendarStore = useCalendarStore()
  const { selectedCategories, selectedRegions, timeFilterStart, timeFilterEnd } = storeToRefs(calendarStore)

  const isTimeFilterActive = computed(() => {
    return timeFilterStart.value !== 0 || timeFilterEnd.value !== MINUTES_PER_DAY
  })

  const hoursFilterLabel = computed(() => {
    const start = timeFilterStart.value ?? 0
    const end = timeFilterEnd.value ?? MINUTES_PER_DAY
    if (start === 0 && end === MINUTES_PER_DAY) {
      return UI_TEXT.hoursFilterAll
    }
    return `${formatMinutesToTime(start)}–${formatMinutesToTime(end)}`
  })

  const filterSummary = computed(() => {
    const ids = selectedCategories.value ?? []
    const regionIds = selectedRegions.value ?? []
    const cats = unref(categories) ?? {}

    const parts = []
    if (ids.length > 0) {
      if (ids.length === 1) {
        const label = cats[ids[0]]?.label ?? EVENT_CATEGORIES[ids[0]]?.label
        parts.push(label || UI_TEXT.categoriesCountLabel(1))
      } else {
        parts.push(UI_TEXT.categoriesCountLabel(ids.length))
      }
    }
    if (regionIds.length > 0) {
      if (regionIds.length === 1 && REGIONS[regionIds[0]]?.label) {
        parts.push(REGIONS[regionIds[0]].label)
      } else {
        parts.push(UI_TEXT.regionsCountLabel(regionIds.length))
      }
    }
    if (isTimeFilterActive.value) {
      parts.push(hoursFilterLabel.value)
    }

    return parts.join(', ')
  })

  const filterButtonLabel = computed(() => {
    return filterSummary.value || UI_TEXT.filterButtonLabel
  })

  const isFilterActive = computed(() => {
    return (
      (selectedCategories.value?.length ?? 0) > 0 ||
      (selectedRegions.value?.length ?? 0) > 0 ||
      isTimeFilterActive.value
    )
  })

  return { filterSummary, filterButtonLabel, hoursFilterLabel, isTimeFilterActive, isFilterActive }
}

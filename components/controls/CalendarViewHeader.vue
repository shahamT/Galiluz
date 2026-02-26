<template>
  <header class="CalendarViewHeader">
    <ControlsCalendarViewNav
      :view-mode="viewMode"
      :month-year="monthYear"
      :current-date="currentDate"
      :categories="categories"
      :selected-categories-count="selectedCategories?.length ?? 0"
      :hours-filter-label="hoursFilterLabel"
      :filter-button-label="filterButtonLabel"
      :is-filter-active="isFilterActive"
      :prev-disabled="prevDisabled"
      :prev-aria-label="prevAriaLabel"
      :next-aria-label="nextAriaLabel"
      @select-month-year="$emit('select-month-year', $event)"
      @year-change="$emit('year-change', $event)"
      @view-change="$emit('view-change', $event)"
      @prev="$emit('prev')"
      @next="$emit('next')"
    />
  </header>
</template>

<script setup>
import { UI_TEXT, MINUTES_PER_DAY } from '~/consts/calendar.const'
import { REGIONS } from '~/consts/regions.const'

import { formatMinutesToTime } from '~/utils/date.helpers'

defineOptions({ name: 'CalendarViewHeader' })

const props = defineProps({
  viewMode: {
    type: String,
    required: true,
    validator: (value) => ['month', 'day'].includes(value),
  },
  monthYear: {
    type: String,
    default: '',
  },
  currentDate: {
    type: Object,
    default: () => ({
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
    }),
  },
  prevDisabled: {
    type: Boolean,
    default: false,
  },
  prevAriaLabel: {
    type: String,
    default: 'Previous',
  },
  nextAriaLabel: {
    type: String,
    default: 'Next',
  },
  categories: {
    type: Object,
    default: () => ({}),
  },
})

defineEmits([
  'select-month-year',
  'year-change',
  'view-change',
  'prev',
  'next',
])

// data
const calendarStore = useCalendarStore()
const { selectedCategories, selectedRegions, timeFilterStart, timeFilterEnd } = storeToRefs(calendarStore)

// computed
const isTimeFilterActive = computed(() => {
  return timeFilterStart.value !== 0 || timeFilterEnd.value !== MINUTES_PER_DAY
})

const isFilterActive = computed(() => {
  return (
    selectedCategories.value.length > 0 ||
    selectedRegions.value.length > 0 ||
    isTimeFilterActive.value
  )
})

const hoursFilterLabel = computed(() => {
  const start = timeFilterStart.value
  const end = timeFilterEnd.value
  if (start === 0 && end === MINUTES_PER_DAY) {
    return UI_TEXT.hoursFilterAll
  }
  return `${formatMinutesToTime(start)}–${formatMinutesToTime(end)}`
})

const filterButtonLabel = computed(() => {
  if (!isFilterActive.value) {
    return UI_TEXT.filterButtonLabel
  }
  const parts = []
  const cats = props.categories ?? {}
  const ids = selectedCategories.value
  const regionIds = selectedRegions.value
  if (ids.length > 0) {
    if (ids.length === 1 && cats[ids[0]]?.label) {
      parts.push(cats[ids[0]].label)
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
  return parts.length ? parts.join(', ') : UI_TEXT.filterButtonLabel
})
</script>

<style lang="scss">
.CalendarViewHeader {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-width: 0;
  max-width: 100%;
}
</style>

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
const { selectedCategories } = storeToRefs(calendarStore)
const { filterButtonLabel, hoursFilterLabel, isFilterActive } = useFilterSummary(toRef(props, 'categories'))
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

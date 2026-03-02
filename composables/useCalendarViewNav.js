import { UI_TEXT } from '~/consts/calendar.const'

/**
 * Composable for CalendarViewNav: popup state, refs, and event handlers.
 * @param {Object} props - Component props (viewMode used for aria labels)
 * @param {Function} emit - Component emit function
 * @returns {Object} State refs, labels, and handlers for the nav template
 */
export function useCalendarViewNav(props, emit) {
  const uiStore = useUiStore()
  const isMonthYearPickerOpen = ref(false)
  const monthTriggerButtonRef = ref(null)
  const isFilterPopupOpen = ref(false)
  const filterTriggerRef = ref(null)

  watch(
    () => uiStore.requestFilterPopupOpen,
    (requested) => {
      if (requested) {
        if (isMonthYearPickerOpen.value) closeMonthYearPicker()
        isFilterPopupOpen.value = true
        uiStore.requestFilterPopupOpen = false
      }
    }
  )

  const viewMonthlyLabel = UI_TEXT.viewMonthly
  const viewDailyLabel = UI_TEXT.viewDaily

  const monthSegmentAriaLabel = computed(() =>
    props.viewMode === 'month' ? 'Monthly view (current)' : 'Switch to monthly view'
  )
  const daySegmentAriaLabel = computed(() =>
    props.viewMode === 'day' ? 'Daily view (current)' : 'Switch to daily view'
  )

  function toggleMonthYearPicker() {
    if (isFilterPopupOpen.value) closeFilterPopup()
    isMonthYearPickerOpen.value = !isMonthYearPickerOpen.value
  }

  function closeMonthYearPicker() {
    isMonthYearPickerOpen.value = false
  }

  function toggleFilterPopup() {
    if (isMonthYearPickerOpen.value) closeMonthYearPicker()
    isFilterPopupOpen.value = !isFilterPopupOpen.value
  }

  function closeFilterPopup() {
    isFilterPopupOpen.value = false
  }

  function handleMonthYearSelect({ year, month }) {
    emit('select-month-year', { year, month })
    closeMonthYearPicker()
  }

  function handleYearChange({ year }) {
    emit('year-change', { year })
  }

  function handleViewSegmentClick(view) {
    if (view === props.viewMode) return
    emit('view-change', { view })
  }

  function handlePrev() {
    emit('prev')
  }

  function handleNext() {
    emit('next')
  }

  return {
    isMonthYearPickerOpen,
    monthTriggerButtonRef,
    isFilterPopupOpen,
    filterTriggerRef,
    viewMonthlyLabel,
    viewDailyLabel,
    monthSegmentAriaLabel,
    daySegmentAriaLabel,
    toggleMonthYearPicker,
    closeMonthYearPicker,
    toggleFilterPopup,
    closeFilterPopup,
    handleMonthYearSelect,
    handleYearChange,
    handleViewSegmentClick,
    handlePrev,
    handleNext,
  }
}

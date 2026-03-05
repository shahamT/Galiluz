import { ROUTE_MONTHLY_VIEW, ROUTE_DAILY_VIEW } from '~/consts/calendar.const'

const FILTER_NOTIFY_AUTO_DISMISS_MS = 8000
const FILTER_NOTIFY_DELAY_MS = 1000

/**
 * Store for the active-filters notification bar.
 * Renders at app root so it persists across route changes and stays on top.
 * Shows once per session when user first reaches calendar view with filters applied.
 */
export const useFilterNotifyStore = defineStore('filterNotify', () => {
  const route = useRoute()
  const visible = ref(false)
  const activeFilterCount = ref(0)
  const filterSummary = ref('')
  const hasShownThisSession = ref(false)
  let autoDismissTimer = null

  const isOnCalendarRoute = computed(() => {
    const path = route.path
    return path === ROUTE_MONTHLY_VIEW || path === ROUTE_DAILY_VIEW
  })

  function clearTimer() {
    if (autoDismissTimer) {
      clearTimeout(autoDismissTimer)
      autoDismissTimer = null
    }
  }

  function requestShow(hasAnyFilter, count, isEventModalShowing, isWelcomeModalShowing, welcomeModalShownThisSession, summary = '') {
    if (!isOnCalendarRoute.value) return
    if (hasShownThisSession.value) return
    if (!hasAnyFilter) return
    if (isEventModalShowing || isWelcomeModalShowing) return
    if (welcomeModalShownThisSession) return

    clearTimer()
    hasShownThisSession.value = true
    activeFilterCount.value = count
    filterSummary.value = summary

    const showTimer = setTimeout(() => {
      visible.value = true
      autoDismissTimer = setTimeout(() => {
        visible.value = false
        autoDismissTimer = null
      }, FILTER_NOTIFY_AUTO_DISMISS_MS)
    }, FILTER_NOTIFY_DELAY_MS)
    autoDismissTimer = showTimer
  }

  function handleReset() {
    clearTimer()
    visible.value = false
    useCalendarStore().resetFilter()
  }

  function handleChangeFilters() {
    clearTimer()
    visible.value = false
    useUiStore().requestOpenFilterPopup()
  }

  function handleClose() {
    clearTimer()
    visible.value = false
  }

  watch(isOnCalendarRoute, (onCalendar) => {
    if (!onCalendar) {
      clearTimer()
      visible.value = false
    }
  })

  return {
    visible,
    activeFilterCount,
    filterSummary,
    hasShownThisSession,
    isOnCalendarRoute,
    requestShow,
    handleReset,
    handleChangeFilters,
    handleClose,
  }
})

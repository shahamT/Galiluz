<template>
  <div v-if="isLoading && !events?.length" class="ContentViewLoader">
    <UiLoader size="md" />
  </div>
  <div v-else class="MonthlyView">
    <div class="MonthlyView-header">
      <ControlsCalendarViewHeader
        view-mode="month"
        :month-year="monthYearDisplay"
        :current-date="currentDate"
        :categories="categories"
        :prev-disabled="isCurrentMonth"
        prev-aria-label="Previous month"
        next-aria-label="Next month"
        @select-month-year="handleMonthYearSelect"
        @year-change="handleYearChange"
        @view-change="handleViewChange"
        @prev="handlePrevMonth"
        @next="handleNextMonth"
      />
    </div>
    <div class="MonthlyView-calendar">
      <CalendarViewContent
        view-mode="month"
        :prev-disabled="isCurrentMonth"
        prev-aria-label="Previous month"
        next-aria-label="Next month"
        @prev="handlePrevMonth"
        @next="handleNextMonth"
      >
        <template #month>
          <div v-if="isError" class="MonthlyView-error">
            <p>{{ UI_TEXT.error }}</p>
          </div>
          <MonthlyMonthCarousel
            v-else
            :visible-months="visibleMonths"
            :current-date="currentDate"
            :events-by-month="eventsByMonth"
            :today-month="todayMonth"
            :slide-to-month-request="slideToMonthRequest"
            :categories="categories"
            @month-change="handleMonthChange"
            @settled="handleSettled"
          />
        </template>
      </CalendarViewContent>
    </div>
  </div>
</template>

<script setup>
import { UI_TEXT } from '~/consts/calendar.const'
import { HEBREW_MONTHS } from '~/consts/dates.const'

import { formatMonthYear, getCurrentYearMonth, getPrevMonth, getNextMonth } from '~/utils/date.helpers'

defineOptions({ name: 'MonthlyView' })

// data
const { events, isLoading, isError, categories, ensureMonthLoaded } = useCalendarViewData()
const calendarStore = useCalendarStore()
const uiStore = useUiStore()
const filterNotifyStore = useFilterNotifyStore()
const { isEventModalShowing, isWelcomeModalShowing, welcomeModalShownThisSession } = storeToRefs(uiStore)
const currentDate = computed(() => calendarStore.currentDate)
const { getFilteredEventsForMonth } = useEventFilters(events)
const { switchToDailyView } = useCalendarNavigation()
const { runPageInit } = useCalendarPageInit({ syncMonth: true })
const { hasAnyFilter, activeFilterCount } = useActiveFilterCount()
const { filterSummary } = useFilterSummary(categories)
const slideToMonthRequest = ref(null)

function checkAndShowFilterNotify() {
  filterNotifyStore.requestShow(
    hasAnyFilter.value,
    activeFilterCount.value,
    isEventModalShowing.value,
    isWelcomeModalShowing.value,
    welcomeModalShownThisSession.value,
    filterSummary.value
  )
}

onMounted(() => {
  runPageInit()
  nextTick(checkAndShowFilterNotify)
})

watch(isEventModalShowing, (isOpen, wasOpen) => {
  if (wasOpen && !isOpen) {
    nextTick(checkAndShowFilterNotify)
  }
})

watch(isWelcomeModalShowing, (isOpen, wasOpen) => {
  if (wasOpen && !isOpen) {
    nextTick(checkAndShowFilterNotify)
  }
})

// computed
const currentYear = computed(() => currentDate.value?.year ?? getCurrentYearMonth().year)
const currentMonth = computed(() => currentDate.value?.month ?? getCurrentYearMonth().month)
const pageTitle = computed(() => 'גלילו"ז')

// SEO: event-specific meta when ?event=id (for social cards)
const { data: eventMeta } = useEventMetaForSeo()
const requestUrl = useRequestURL()
const defaultOgImage = new URL('/galiluz-thumbnail.png', requestUrl.origin).href
const MONTHLY_DEFAULT_DESC = 'יומן אירועים חודשי של Galiluz - צפייה בכל האירועים והפעילויות החודשיות'

const seoTitle = computed(() =>
  eventMeta.value?.title ? `גלילו"ז - ${eventMeta.value.title}` : pageTitle.value
)
const seoDescription = computed(() =>
  eventMeta.value?.shortDescription || eventMeta.value?.title || MONTHLY_DEFAULT_DESC
)
const seoImage = computed(() =>
  eventMeta.value?.imageUrl || defaultOgImage
)

useHead({ title: seoTitle })
useSeoMeta({
  title: seoTitle,
  description: seoDescription,
  ogTitle: seoTitle,
  ogDescription: seoDescription,
  ogImage: seoImage,
  ogUrl: requestUrl.href,
  ogType: 'website',
  ogSiteName: 'גלילו"ז',
  ogLocale: 'he_IL',
  twitterCard: 'summary_large_image',
  twitterTitle: seoTitle,
  twitterDescription: seoDescription,
  twitterImage: seoImage,
})
const monthYearDisplay = computed(() => {
  return formatMonthYear(currentYear.value, currentMonth.value)
})
// Avoid hydration mismatch: server cannot know "current month" (no client date). Use same value
// on first paint (false), then apply real value after mount.
const isMounted = ref(false)
onMounted(() => {
  isMounted.value = true
})
const isCurrentMonth = computed(() => {
  if (!isMounted.value) return false
  const now = new Date()
  const date = currentDate.value
  return date && date.year === now.getFullYear() && date.month === now.getMonth() + 1
})
const todayMonth = computed(() => getCurrentYearMonth())

// The slide window is owned locally, decoupled from the store: the store updates on every
// swipe commit (mid-animation) while the window only re-centers after the slide settles,
// so slides never shift under an in-flight animation.
const MONTH_CAROUSEL_RANGE = 2
const windowCenter = ref(currentDate.value ?? getCurrentYearMonth())
const visibleMonths = computed(() => {
  const c = windowCenter.value ?? getCurrentYearMonth()
  if (!c?.year || !c?.month) return []
  const months = []
  for (let off = -MONTH_CAROUSEL_RANGE; off <= MONTH_CAROUSEL_RANGE; off++) {
    const d = new Date(c.year, c.month - 1 + off, 1)
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }
  return months
})
// Each slide gets its own month's events so neighbor months render correctly during the swipe
const eventsByMonth = computed(() => {
  const map = {}
  for (const m of visibleMonths.value) {
    map[`${m.year}-${m.month}`] = getFilteredEventsForMonth(m.year, m.month)
  }
  return map
})

// methods
const navigateMonth = (targetMonth) => {
  const isInVisibleMonths = visibleMonths.value.some(
    (m) => m.year === targetMonth.year && m.month === targetMonth.month
  )
  if (isInVisibleMonths) {
    slideToMonthRequest.value = targetMonth
  } else {
    calendarStore.setCurrentDate(targetMonth)
  }
}

const handlePrevMonth = () => {
  navigateMonth(getPrevMonth(currentDate.value.year, currentDate.value.month))
}

const handleNextMonth = () => {
  navigateMonth(getNextMonth(currentDate.value.year, currentDate.value.month))
}

// Swipe committed: sync the store immediately (header/URL update while the animation runs)
const handleMonthChange = (payload) => {
  calendarStore.setCurrentDate(payload)
  slideToMonthRequest.value = null
}

// Slide settled: re-center the window only when the active month nears its edge
const handleSettled = (activeMonth) => {
  const months = visibleMonths.value
  const idx = months.findIndex((m) => m.year === activeMonth.year && m.month === activeMonth.month)
  if (idx < 0) return
  if (idx < 2 || idx > months.length - 3) {
    windowCenter.value = activeMonth
  }
}

// External month change (picker far jump, deep link): rebuild the window around it.
// In-window changes are handled by the carousel's currentDate watcher.
watch(currentDate, (c) => {
  if (!c?.year || !c?.month) return
  const inWindow = visibleMonths.value.some((m) => m.year === c.year && m.month === c.month)
  if (!inWindow) windowCenter.value = { year: c.year, month: c.month }
}, { deep: true })
// Keep the events feed window covering the viewed month (expands on far-future navigation)
watch(currentDate, (c) => { if (c?.year && c?.month) ensureMonthLoaded(c.year, c.month) }, { immediate: true, deep: true })

const handleMonthYearSelect = ({ year, month }) => {
  calendarStore.setCurrentDate({ year, month })
}

const handleYearChange = ({ year }) => {
  calendarStore.setCurrentDate({ ...currentDate.value, year })
}

const handleViewChange = ({ view }) => {
  if (view !== 'day') return
  switchToDailyView(currentDate.value)
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.ContentViewLoader {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.MonthlyView {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100%;
  gap: var(--spacing-md);
  min-height: 0;
  min-width: 0;

  @include mobile {
    gap: 0;
  }

  &-header {
    grid-row: 1;
    min-width: 0;
    max-width: 100%;

    @include mobile {
      padding-inline: 1rem;
    }
  }

  &-calendar {
    grid-row: 2;
    min-height: 0;
    min-width: 0;

    @include mobile {
      padding-inline: 4px;
    }
  }

  &-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: var(--spacing-md);
    color: var(--color-text-light);
  }
}
</style>

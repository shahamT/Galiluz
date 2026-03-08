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
            :filtered-events="filteredEvents"
            :today-month="todayMonth"
            :slide-to-month-request="slideToMonthRequest"
            :categories="categories"
            @month-change="handleMonthChange"
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
const { events, isLoading, isError, categories } = useCalendarViewData()
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
const pageTitle = computed(() => `גלילו"ז - ${HEBREW_MONTHS[currentMonth.value - 1]}`)

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

useHead({
  title: seoTitle,
  link: [{ rel: 'canonical', href: `${requestUrl.origin}/events/monthly-view` }],
  script: computed(() => {
    if (!eventMeta.value?.title) return []
    const month = String(currentMonth.value).padStart(2, '0')
    return [{
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: seoTitle.value,
        startDate: `${currentYear.value}-${month}-01`,
        description: seoDescription.value,
        image: seoImage.value,
        url: requestUrl.href,
        organizer: { '@type': 'Organization', name: 'גלילו"ז', url: requestUrl.origin },
      }),
    }]
  }),
})
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
const visibleMonths = computed(() => {
  const c = currentDate.value ?? getCurrentYearMonth()
  if (!c?.year || !c?.month) return []
  return [
    getPrevMonth(c.year, c.month),
    { year: c.year, month: c.month },
    getNextMonth(c.year, c.month),
  ]
})
const filteredEvents = computed(() => {
  return getFilteredEventsForMonth(currentYear.value, currentMonth.value)
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

const handleMonthChange = (payload) => {
  calendarStore.setCurrentDate(payload)
  slideToMonthRequest.value = null
}

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

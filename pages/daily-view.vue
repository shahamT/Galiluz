<template>
  <LayoutAppShell>
    <div v-if="isLoading && !events?.length" class="ContentViewLoader">
      <UiLoader size="md" />
    </div>
    <div v-else class="DailyView">
      <div class="DailyView-header">
        <ControlsCalendarViewHeader
          view-mode="day"
          :month-year="monthYearDisplay"
          :current-date="headerDate"
          :categories="categories"
          :prev-disabled="isTodayOrPast"
          prev-aria-label="Previous day"
          next-aria-label="Next day"
          @select-month-year="handleMonthYearSelect"
          @year-change="handleYearChange"
          @view-change="handleViewChange"
          @prev="handlePrevDay"
          @next="handleNextDay"
        />
      </div>
      <div class="DailyView-content">
        <CalendarViewContent
          view-mode="day"
          :prev-disabled="isTodayOrPast"
          prev-aria-label="Previous day"
          next-aria-label="Next day"
          @prev="handlePrevDay"
          @next="handleNextDay"
        >
          <template #day>
            <div v-if="isError" class="DailyView-error">
              <p>{{ UI_TEXT.error }}</p>
            </div>
            <div v-else class="DailyView-kanbanWrapper">
              <DailyKanbanCarousel
                :key="dateParam"
                :visible-days="visibleDays"
                :events-by-date="eventsByDate"
                :current-date="dateParam"
                :today="today"
                :slide-to-date-request="slideToDateRequest"
                :categories="categories"
                @date-change="handleDateChange"
              />
            </div>
          </template>
        </CalendarViewContent>
      </div>
    </div>
  </LayoutAppShell>
</template>

<script setup>
import { UI_TEXT, DAILY_CAROUSEL_DAYS_RANGE, ROUTE_DAILY_VIEW } from '~/consts/calendar.const'
import { HEBREW_MONTHS } from '~/consts/dates.const'

import { getTodayDateString, formatMonthYear, parseDateString, formatDateToYYYYMMDD } from '~/utils/date.helpers'
import { isValidRouteDate } from '~/utils/validation.helpers'

defineOptions({ name: 'DailyView' })

// data
const route = useRoute()
const router = useRouter()
const { events, isLoading, isError, categories } = useCalendarViewData()
const calendarStore = useCalendarStore()
const { getFilteredEventsByDate } = useEventFilters(events)
const { navigateToMonth, navigateToMonthInDailyView, navigateToDay, goToPrevDay, goToNextDay } = useCalendarNavigation()
const { runPageInit } = useCalendarPageInit({ syncMonth: false })
const slideToDateRequest = ref(null)

// lifecycle
onMounted(async () => {
  const dateFromQuery = route.query.date
  const eventFromQuery = route.query.event
  const hasValidDate = dateFromQuery && isValidRouteDate(String(dateFromQuery).trim())

  if (!hasValidDate && eventFromQuery && typeof eventFromQuery === 'string') {
    const eventParam = String(eventFromQuery).trim()
    try {
      const { date, eventId } = await $fetch(`/api/events/${encodeURIComponent(eventParam)}/first-occurrence`)
      await router.replace({ path: ROUTE_DAILY_VIEW, query: { date, event: eventId } })
      await nextTick()
      runPageInit()
      return
    } catch {
      await router.replace({ path: ROUTE_DAILY_VIEW, query: { ...route.query, date: getTodayDateString() } })
    }
  } else if (!hasValidDate) {
    await router.replace({ path: ROUTE_DAILY_VIEW, query: { ...route.query, date: getTodayDateString() } })
  }
  await nextTick()
  runPageInit()
})

// computed
const dateParam = computed(() => {
  const param = route.query.date
  if (param && isValidRouteDate(String(param).trim())) {
    return String(param).trim().slice(0, 10)
  }
  return getTodayDateString()
})
const pageTitle = computed(() => {
  const date = parseDateString(dateParam.value)
  const day = date.getDate()
  const monthName = HEBREW_MONTHS[date.getMonth()]
  return `גלילו"ז - ${day} ב${monthName}`
})
const headerDate = computed(() => {
  const date = parseDateString(dateParam.value)
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  }
})
const monthYearDisplay = computed(() => {
  return formatMonthYear(headerDate.value.year, headerDate.value.month)
})
const visibleDays = computed(() => {
  const centerDate = parseDateString(dateParam.value)
  const days = []
  for (let i = -DAILY_CAROUSEL_DAYS_RANGE; i <= DAILY_CAROUSEL_DAYS_RANGE; i++) {
    const date = new Date(centerDate)
    date.setDate(centerDate.getDate() + i)
    days.push(formatDateToYYYYMMDD(date))
  }
  return days
})
const today = computed(() => getTodayDateString())
// Avoid hydration mismatch: server date can differ from client. Use same value on first paint (false).
const isMounted = ref(false)
onMounted(() => {
  isMounted.value = true
})
const isTodayOrPast = computed(() => {
  if (!isMounted.value) return false
  return dateParam.value <= today.value
})
const eventsByDate = computed(() => getFilteredEventsByDate(visibleDays.value))

// SEO: event-specific meta when ?event=id (for social cards)
const { data: eventMeta } = useEventMetaForSeo()
const requestUrl = useRequestURL()
const defaultOgImage = new URL('/galiluz-thumbnail.png', requestUrl.origin).href
const DAILY_DEFAULT_DESC = 'תצוגה יומית של אירועים ופעילויות ב-Galiluz'

const seoTitle = computed(() =>
  eventMeta.value?.title ? `גלילו"ז - ${eventMeta.value.title}` : pageTitle.value
)
const seoDescription = computed(() =>
  eventMeta.value?.shortDescription || eventMeta.value?.title || DAILY_DEFAULT_DESC
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

// methods
const handlePrevDay = () => {
  if (isTodayOrPast.value) return
  const targetDate = goToPrevDay(dateParam.value)
  if (visibleDays.value.includes(targetDate)) {
    slideToDateRequest.value = targetDate
  } else {
    navigateToDay(targetDate)
  }
}

const handleNextDay = () => {
  const targetDate = goToNextDay(dateParam.value)
  if (visibleDays.value.includes(targetDate)) {
    slideToDateRequest.value = targetDate
  } else {
    navigateToDay(targetDate)
  }
}

const handleMonthYearSelect = ({ year, month }) => {
  navigateToMonthInDailyView(year, month)
}

// Year change in month picker should not close popup or navigate - only month select triggers navigation
const handleYearChange = ({ year }) => {
  calendarStore.setCurrentDate({ year, month: headerDate.value.month })
}

const handleDateChange = (newDate) => {
  navigateToDay(newDate)
  slideToDateRequest.value = null
}

const handleBackToMonthly = () => {
  navigateToMonth(headerDate.value.year, headerDate.value.month)
}

const handleViewChange = ({ view }) => {
  if (view === 'month') handleBackToMonthly()
}

// watchers
watch(headerDate, (newHeaderDate) => {
  calendarStore.setCurrentDate(newHeaderDate)
}, { immediate: true })
watch(dateParam, (date) => {
  if (date && isValidRouteDate(date)) {
    calendarStore.setLastDailyViewDate(date)
  }
}, { immediate: true })
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

.DailyView {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100%;
  gap: var(--spacing-md);
  min-height: 0;
  min-width: 0;

  &-header {
    grid-row: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    min-width: 0;
    max-width: 100%;

    @include mobile {
      padding-inline: 1rem;
    }
  }

  &-content {
    grid-row: 2;
    min-height: 0;
    min-width: 0;

    @include mobile {
      display: flex;
      flex-direction: column;
    }
  }

  &-kanbanWrapper {
    @include mobile {
      height: calc(
        100dvh
        - var(--header-height)
        - (2 * var(--spacing-md))
        - var(--daily-view-header-height)
        - var(--spacing-md)
      );
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
  }

  &-error {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-text-light);
  }
}
</style>

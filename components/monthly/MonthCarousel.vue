<template>
  <section class="MonthCarousel">
    <swiper
      ref="swiperRef"
      :slides-per-view="1"
      :space-between="0"
      :centered-slides="true"
      :speed="600"
      :allow-touch-move="true"
      :resistance="true"
      :resistance-ratio="0"
      :dir="'rtl'"
      :initial-slide="1"
      :allow-slide-prev="canSlideToPast"
      :on="swiperEventHandlers"
      @swiper="onSwiperReady"
      @slide-change="handleSlideChange"
      @slide-change-transition-end="handleSlideChangeTransitionEnd"
      class="MonthCarousel-swiper"
    >
      <swiper-slide
        v-for="month in visibleMonths"
        :key="`${month.year}-${month.month}`"
        class="MonthCarousel-slide"
      >
        <MonthlyMonthCalendar
          :date="month"
          :events="filteredEvents"
          :categories="categories"
        />
      </swiper-slide>
    </swiper>
  </section>
</template>

<script setup>
import { Swiper, SwiperSlide } from 'swiper/vue'
import { isMonthBefore, isSameMonth } from '~/utils/date.helpers'

defineOptions({ name: 'MonthCarousel' })

const props = defineProps({
  visibleMonths: {
    type: Array,
    required: true,
  },
  currentDate: {
    type: Object,
    required: true,
  },
  filteredEvents: {
    type: Array,
    default: () => [],
  },
  todayMonth: {
    type: Object,
    required: true,
  },
  slideToMonthRequest: {
    type: Object,
    default: null,
  },
  categories: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['month-change'])

const swiperRef = ref(null)
const swiperInstance = ref(null)
const activeIndexRef = ref(1)
const isProgrammaticSlideRef = ref(false)

const firstValidIndex = computed(() => {
  return props.visibleMonths.findIndex((m) => !isMonthBefore(m, props.todayMonth))
})

const canSlideToPast = computed(() => {
  return firstValidIndex.value >= 0 && activeIndexRef.value > firstValidIndex.value
})

const swiperEventHandlers = {
  touchStart(swiper) {
    const allow = firstValidIndex.value >= 0 && swiper.activeIndex > firstValidIndex.value
    swiper.allowSlidePrev = allow
    swiper.params.allowSlidePrev = allow
  },
}

const onSwiperReady = (swiper) => {
  swiperInstance.value = swiper
  activeIndexRef.value = swiper.activeIndex
  const allow = firstValidIndex.value >= 0 && swiper.activeIndex > firstValidIndex.value
  swiper.allowSlidePrev = allow
  swiper.params.allowSlidePrev = allow
}

const handleSlideChange = (swiper) => {
  const activeIndex = swiper.activeIndex
  const activeMonth = props.visibleMonths[activeIndex]

  // Skip snap-back when slide was triggered by store update; only snap on user swipe
  if (
    !isProgrammaticSlideRef.value &&
    activeMonth &&
    isMonthBefore(activeMonth, props.todayMonth) &&
    firstValidIndex.value >= 0
  ) {
    swiper.slideTo(firstValidIndex.value)
    return
  }

  const allow = firstValidIndex.value >= 0 && activeIndex > firstValidIndex.value
  swiper.allowSlidePrev = allow
  swiper.params.allowSlidePrev = allow
}

const handleSlideChangeTransitionEnd = (swiper) => {
  const activeIndex = swiper.activeIndex
  const activeMonth = props.visibleMonths[activeIndex]
  const wasProgrammatic = isProgrammaticSlideRef.value

  isProgrammaticSlideRef.value = false
  activeIndexRef.value = activeIndex

  // Only emit on user swipe; store already has correct value for programmatic slides
  if (activeMonth && !wasProgrammatic) {
    emit('month-change', { year: activeMonth.year, month: activeMonth.month })
  }

  const allow = firstValidIndex.value >= 0 && activeIndex > firstValidIndex.value
  swiper.allowSlidePrev = allow
  swiper.params.allowSlidePrev = allow
}

watch(
  () => props.currentDate,
  () => {
    const swiper = swiperInstance.value
    if (!swiper) return
    const newIndex = props.visibleMonths.findIndex((m) => isSameMonth(m, props.currentDate))
    if (newIndex >= 0 && newIndex !== swiper.activeIndex) {
      isProgrammaticSlideRef.value = true
      swiper.slideTo(newIndex, 0)
    }
  }
)

watch(
  () => props.slideToMonthRequest,
  (requestedMonth) => {
    if (!requestedMonth) return
    const swiper = swiperInstance.value
    if (!swiper) return
    const index = props.visibleMonths.findIndex((m) => isSameMonth(m, requestedMonth))
    if (index >= 0 && index !== swiper.activeIndex) {
      swiper.slideTo(index)
    }
  }
)
</script>

<style>
@import 'swiper/css';
</style>

<style lang="scss">
.MonthCarousel {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  position: relative;
  overflow: hidden;
  direction: rtl;
  height: 100%;
  min-height: 0;

  &-swiper {
    width: 100%;
    max-width: 100%;
    overflow: hidden;
    padding: 0;
    height: 100%;
  }

  &-slide {
    width: 100%;
    display: flex;
    align-items: flex-start;
    justify-content: stretch;
    min-width: 0;
    height: auto;
  }
}

// Constrain wrapper and slides so one month fills the container and layout does not break
.MonthCarousel-swiper {
  .swiper-wrapper {
    width: calc(3 * 100%) !important;
    align-items: flex-start;
    padding-bottom: var(--spacing-lg);
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }

  .swiper-slide {
    height: auto;
    width: calc(100% / 3) !important;
    box-sizing: border-box;
    flex-shrink: 0;

    // So the calendar inside fills the full slide width
    > * {
      width: 100%;
      min-width: 0;
    }

    // Only the visible month shows day cell shadows
    &:not(.swiper-slide-active) .DayCell {
      box-shadow: none;
    }
  }

  .swiper-button-next,
  .swiper-button-prev,
  .swiper-pagination {
    display: none;
  }
}
</style>

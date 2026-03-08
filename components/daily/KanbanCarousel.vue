<template>
  <section class="KanbanCarousel">
    <swiper
      ref="swiperRef"
      :slides-per-view="slidesPerView"
      :space-between="spaceBetween"
      :centered-slides="true"
      :speed="600"
      :allow-touch-move="true"
      :resistance="true"
      :resistance-ratio="0"
      :dir="'rtl'"
      :initial-slide="initialSlideIndex"
      :allow-slide-prev="canSlideToPast"
      :on="swiperEventHandlers"
      @swiper="onSwiperReady"
      @slide-change="handleSlideChange"
      @slide-change-transition-end="handleSlideChangeTransitionEnd"
      :breakpoints="swiperBreakpoints"
      class="KanbanCarousel-swiper"
    >
      <swiper-slide
        v-for="date in visibleDays"
        :key="date"
        class="KanbanCarousel-slide"
      >
        <DailyKanbanColumn
          :date="date"
          :events="eventsByDate[date] || []"
          :is-disabled="isDatePast(date)"
          :categories="categories"
        />
      </swiper-slide>
    </swiper>
  </section>
</template>

<script setup>
import { Swiper, SwiperSlide } from 'swiper/vue'

defineOptions({ name: 'KanbanCarousel' })

const slidesPerView = 3
const spaceBetween = 24

const swiperBreakpoints = {
  0: {
    slidesPerView: 'auto',
    spaceBetween: 16,
    centeredSlides: true,
    centeredSlidesBounds: true,
  },
  769: {
    slidesPerView: 3,
    spaceBetween: 24,
  },
}

const props = defineProps({
  visibleDays: {
    type: Array,
    required: true,
  },
  eventsByDate: {
    type: Object,
    required: true,
  },
  currentDate: {
    type: String,
    required: true,
  },
  today: {
    type: String,
    required: true,
  },
  slideToDateRequest: {
    type: String,
    default: null,
  },
  categories: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['date-change'])

const swiperRef = ref(null)
// Swiper instance from @swiper callback (ref on component may not expose .swiper in Swiper Vue)
const swiperInstance = ref(null)
// Track active slide index so allowSlidePrev can stay in sync (Swiper reads params at init/update)
const activeIndexRef = ref(0)

// Find the index of currentDate in visibleDays (should be index 5, the center of 11 slides)
const initialSlideIndex = computed(() => {
  const index = props.visibleDays.findIndex((date) => date === props.currentDate)
  return index >= 0 ? index : 5 // Default to center if not found
})

// First valid date index (today or first future); do not allow sliding to the right (past) when on this slide
const firstValidIndex = computed(() => {
  return props.visibleDays.findIndex((date) => date >= props.today)
})

const isDatePast = (date) => {
  return date < props.today
}

// Only allow sliding to past when current slide is after today
const canSlideToPast = computed(() => {
  return firstValidIndex.value >= 0 && activeIndexRef.value > firstValidIndex.value
})

// Re-apply lock at start of each touch so Swiper respects it during drag
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
  const activeDate = props.visibleDays[activeIndex]

  // Snap back to today if user ended up on a past date slide (emit happens in transition end)
  if (activeDate < props.today && firstValidIndex.value >= 0) {
    swiper.slideTo(firstValidIndex.value)
    return
  }

  const allow = firstValidIndex.value >= 0 && activeIndex > firstValidIndex.value
  swiper.allowSlidePrev = allow
  swiper.params.allowSlidePrev = allow
}

// Emit date-change only after slide animation completes so parent navigates after transition
const handleSlideChangeTransitionEnd = (swiper) => {
  const activeIndex = swiper.activeIndex
  const activeDate = props.visibleDays[activeIndex]

  activeIndexRef.value = activeIndex
  if (activeDate) {
    emit('date-change', activeDate)
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
    const newIndex = props.visibleDays.findIndex((date) => date === props.currentDate)
    if (newIndex >= 0 && newIndex !== swiper.activeIndex) {
      swiper.slideTo(newIndex)
    }
  }
)

watch(
  () => props.slideToDateRequest,
  (requestedDate) => {
    if (!requestedDate || !props.visibleDays.includes(requestedDate)) return
    const swiper = swiperInstance.value
    if (!swiper) return
    const index = props.visibleDays.findIndex((date) => date === requestedDate)
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
@use '~/assets/css/breakpoints' as *;

.KanbanCarousel {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  position: relative;
  overflow: hidden;
  direction: rtl; // Ensure RTL direction
  box-sizing: border-box;

  &-swiper {
    width: 100%;
    max-width: 100%;
    overflow: hidden;
    padding: 0;
  }

  &-slide {
    width: 100%;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    min-width: 0;
  }

  @include mobile {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding-bottom: var(--spacing-sm);

    .KanbanCarousel-swiper {
      flex: 1;
      min-height: 0;
      height: 100%;
      display: flex;
      flex-direction: column;

      .swiper-wrapper,
      .swiper-slide {
        height: 100%;
      }
    }
  }
}

// Swiper RTL and styling overrides
.KanbanCarousel-swiper {
  .swiper-wrapper {
    align-items: flex-start;
    padding-bottom: var(--spacing-lg); // Prevent shadow cropping
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }

  .swiper-slide {
    box-sizing: border-box;
    flex-shrink: 0;
    height: auto;
  }

  // Desktop: 3 slides per view
  @include desktop {
    .swiper-wrapper {
      width: calc(11 * (100% - 2 * var(--spacing-lg)) / 3) !important;
    }

    .swiper-slide {
      width: calc(100% / 11) !important;
    }
  }

  // Mobile: slides managed by slidesPerView prop (1.15)
  @include mobile {
    .swiper-slide {
      width: auto !important;
    }
  }

  // Hide default navigation/pagination
  .swiper-button-next,
  .swiper-button-prev,
  .swiper-pagination {
    display: none;
  }
}
</style>

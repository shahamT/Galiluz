<template>
  <div class="CalendarViewContent">
    <div class="CalendarViewContent-navArrow CalendarViewContent-navArrow--prev">
      <UiCalendarNavArrow
        direction="prev"
        :disabled="prevDisabled"
        :aria-label="prevAriaLabel"
        @click="$emit('prev')"
      />
    </div>
    <div class="CalendarViewContent-navArrow CalendarViewContent-navArrow--next">
      <UiCalendarNavArrow
        direction="next"
        :aria-label="nextAriaLabel"
        @click="$emit('next')"
      />
    </div>
    <div class="CalendarViewContent-body">
      <slot name="month" v-if="viewMode === 'month'" />
      <slot name="day" v-else-if="viewMode === 'day'" />
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'CalendarViewContent' })

defineProps({
  viewMode: {
    type: String,
    required: true,
    validator: (v) => ['month', 'day'].includes(v),
  },
  prevDisabled: {
    type: Boolean,
    default: false,
  },
  prevAriaLabel: {
    type: String,
    required: true,
  },
  nextAriaLabel: {
    type: String,
    required: true,
  },
})

defineEmits(['prev', 'next'])
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.CalendarViewContent {
  position: relative;
  width: 100%;
  min-height: 0;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;

  &-body {
    flex: 1;
    width: 100%;
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow-x: clip;
    padding: 0;
  }

  &-navArrow {
    position: absolute;
    top: 6px;
    z-index: 1;

    @include mobile {
      display: none;
    }
  }

  &-navArrow--prev {
    right: -50px;
    left: auto;
  }

  &-navArrow--next {
    left: -50px;
    right: auto;
  }
}
</style>

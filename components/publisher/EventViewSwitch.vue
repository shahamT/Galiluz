<template>
  <div class="EventViewSwitch" role="group" aria-label="תצוגת אירוע">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="EventViewSwitch-segment"
      :class="{ 'EventViewSwitch-segment--active': modelValue === opt.value }"
      :aria-pressed="modelValue === opt.value"
      @click="emit('update:modelValue', opt.value)"
    >
      <UiIcon :name="opt.icon" size="sm" />
      <span class="EventViewSwitch-label">{{ opt.label }}</span>
      <span class="EventViewSwitch-labelMobile">{{ opt.mobileLabel }}</span>
    </button>
  </div>
</template>

<script setup>
defineOptions({ name: 'EventViewSwitch' })
defineProps({ modelValue: { type: String, default: 'actions' } })
const emit = defineEmits(['update:modelValue'])

const options = [
  { value: 'actions', label: 'ניהול',         mobileLabel: 'ניהול',   icon: 'tune' },
  { value: 'preview', label: 'תצוגת האירוע', mobileLabel: 'תצוגה',   icon: 'event' },
  { value: 'stats',   label: 'סטטיסטיקות',   mobileLabel: 'נתונים',  icon: 'bar_chart' },
]
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.EventViewSwitch {
  display: flex;
  align-items: stretch;
  height: var(--control-height);
  border-radius: var(--radius-md);
  overflow: hidden;
  background-color: rgba(255, 255, 255, 0.7);
  width: fit-content;
  padding: 2px;
  gap: 1px;

  @include mobile {
    height: var(--section-header-height);
    width: 100%;
  }

  &-segment {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: 0 var(--spacing-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: var(--font-family-body);
    color: var(--color-text-light);
    background-color: transparent;
    border: none;
    border-radius: calc(var(--radius-md) - 2px);
    cursor: pointer;
    white-space: nowrap;
    transition: background-color 0.15s, color 0.15s, box-shadow 0.15s;

    &:hover:not(.EventViewSwitch-segment--active) {
      background-color: rgba(0, 0, 0, 0.05);
    }

    &--active {
      background-color: var(--color-background);
      color: var(--brand-dark-green);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }

    @include mobile {
      flex: 1;
      justify-content: center;
      padding: 0 var(--spacing-sm);
    }

    .EventViewSwitch-labelMobile { display: none; }

    @include mobile {
      .EventViewSwitch-label { display: none; }
      .EventViewSwitch-labelMobile { display: inline; }
    }
  }
}
</style>

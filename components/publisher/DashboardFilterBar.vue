<template>
  <div class="DashboardFilterBar" role="group" aria-label="סינון נתונים">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="DashboardFilterBar-segment"
      :class="{ 'DashboardFilterBar-segment--active': modelValue === opt.value }"
      :aria-pressed="modelValue === opt.value"
      @click="emit('update:modelValue', opt.value)"
    >
      <UiIcon :name="opt.icon" size="sm" />
      <span class="DashboardFilterBar-label">{{ opt.label }}</span>
      <span class="DashboardFilterBar-labelMobile">{{ opt.mobileLabel }}</span>
    </button>
  </div>
</template>

<script setup>
defineOptions({ name: 'DashboardFilterBar' })
defineProps({ modelValue: { type: String, default: 'all' } })
const emit = defineEmits(['update:modelValue'])

const options = [
  { value: 'all',    label: 'כל האירועים',    mobileLabel: 'הכל',              icon: 'history' },
  { value: 'active', label: 'אירועים עתידיים', mobileLabel: 'אירועים עתידיים', icon: 'event_available' },
  { value: 'month',  label: 'אירועים החודש',   mobileLabel: 'החודש',            icon: 'calendar_today' },
]
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.DashboardFilterBar {
  display: flex;
  align-items: stretch;
  height: var(--control-height);
  border-radius: var(--radius-md);
  overflow: hidden;
  background-color: var(--light-bg);
  width: fit-content;
  margin-bottom: var(--spacing-lg);

  @include mobile {
    height: var(--control-height-mobile);
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
    color: var(--brand-dark-green);
    background-color: transparent;
    border: none;
    cursor: pointer;
    white-space: nowrap;
    transition: background-color 0.2s ease, color 0.2s ease;

    &:hover:not(.DashboardFilterBar-segment--active) {
      background-color: var(--day-cell-hover-bg);
    }

    &--active {
      background-color: var(--brand-dark-green);
      color: var(--chip-text-white);
    }

    @include mobile {
      flex: 1;
      justify-content: center;
      padding: 0 var(--spacing-sm);
    }

    .DashboardFilterBar-labelMobile { display: none; }

    @include mobile {
      .DashboardFilterBar-label { display: none; }
      .DashboardFilterBar-labelMobile { display: inline; }
    }
  }
}
</style>

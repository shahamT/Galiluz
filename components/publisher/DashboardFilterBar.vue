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
  background-color: rgba(255, 255, 255, 0.7);
  width: fit-content;
  margin-bottom: var(--spacing-lg);
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

    &:hover:not(.DashboardFilterBar-segment--active) {
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

    .DashboardFilterBar-labelMobile { display: none; }

    @include mobile {
      .DashboardFilterBar-label { display: none; }
      .DashboardFilterBar-labelMobile { display: inline; }
    }
  }
}
</style>

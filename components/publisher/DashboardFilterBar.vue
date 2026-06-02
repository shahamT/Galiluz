<template>
  <div class="DashboardFilterBar">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="DashboardFilterBar-chip"
      :class="{ 'DashboardFilterBar-chip--active': modelValue === opt.value }"
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup>
defineOptions({ name: 'DashboardFilterBar' })
defineProps({ modelValue: { type: String, default: 'all' } })
const emit = defineEmits(['update:modelValue'])

const options = [
  { value: 'all', label: 'כל הזמנים' },
  { value: 'active', label: 'אירועים פעילים' },
  { value: 'month', label: 'החודש' },
]
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.DashboardFilterBar {
  display: flex;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-lg);

  &-chip {
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--control-height);
    padding: 0 var(--spacing-md);
    border: 2px solid var(--brand-dark-green);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--brand-dark-green);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;
    white-space: nowrap;

    &:hover { background-color: var(--brand-dark-green); color: var(--chip-text-white); }

    &--active {
      background: var(--brand-dark-green);
      color: var(--chip-text-white);
    }

    @include mobile {
      height: var(--section-header-height);
      font-size: var(--font-size-md);
    }
  }
}
</style>

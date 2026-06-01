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
.DashboardFilterBar {
  display: flex;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-lg);

  &-chip {
    padding: var(--spacing-xs) var(--spacing-md);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-background);
    color: var(--color-text-light);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;

    &:hover { border-color: var(--brand-dark-green); color: var(--brand-dark-green); }

    &--active {
      background: var(--brand-dark-green);
      border-color: var(--brand-dark-green);
      color: #fff;
      font-weight: 600;
    }
  }
}
</style>

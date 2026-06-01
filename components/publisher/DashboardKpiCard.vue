<template>
  <div class="DashboardKpiCard">
    <span class="DashboardKpiCard-icon material-symbols-rounded" :style="{ color: color }">{{ icon }}</span>
    <span class="DashboardKpiCard-value">{{ formattedValue }}</span>
    <span class="DashboardKpiCard-label">{{ label }}</span>
  </div>
</template>

<script setup>
defineOptions({ name: 'DashboardKpiCard' })
const props = defineProps({
  label: { type: String, required: true },
  value: { type: Number, default: 0 },
  icon: { type: String, default: 'bar_chart' },
  color: { type: String, default: 'var(--brand-dark-green)' },
})
const formattedValue = computed(() =>
  props.value >= 1000 ? `${(props.value / 1000).toFixed(1)}K` : String(props.value)
)
</script>

<style lang="scss">
.DashboardKpiCard {
  background: var(--color-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-xs);
  flex: 1;
  min-width: 0;

  &-icon {
    font-size: 1.5rem;
    line-height: 1;
  }

  &-value {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--color-text);
    line-height: 1;
  }

  &-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-light);
  }
}
</style>

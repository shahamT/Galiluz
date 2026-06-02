<template>
  <div class="DashboardKpiCard">
    <template v-if="loading">
      <div class="DashboardKpiCard-skeleton DashboardKpiCard-skeleton--icon" />
      <div class="DashboardKpiCard-skeleton DashboardKpiCard-skeleton--value" />
      <div class="DashboardKpiCard-skeleton DashboardKpiCard-skeleton--label" />
    </template>
    <template v-else>
      <UiIcon :name="icon" size="md" class="DashboardKpiCard-icon" :style="{ color: color }" />
      <span class="DashboardKpiCard-value">{{ formattedValue }}</span>
      <span class="DashboardKpiCard-label">{{ label }}</span>
    </template>
  </div>
</template>

<script setup>
defineOptions({ name: 'DashboardKpiCard' })
const props = defineProps({
  label: { type: String, required: true },
  value: { type: Number, default: 0 },
  icon: { type: String, default: 'bar_chart' },
  color: { type: String, default: 'var(--brand-dark-green)' },
  loading: { type: Boolean, default: false },
})
const formattedValue = computed(() =>
  props.value >= 1000 ? `${(props.value / 1000).toFixed(1)}K` : String(props.value)
)

function hexToRgb(hex) {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

function colorToRgb(color) {
  if (color.startsWith('#')) return hexToRgb(color)
  return '11, 151, 74'
}

const bgColor = computed(() => `rgba(${colorToRgb(props.color)}, 0.08)`)
const borderColor = computed(() => `rgba(${colorToRgb(props.color)}, 0.2)`)
</script>

<style lang="scss">
.DashboardKpiCard {
  background: var(--light-bg);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  flex: 1;
  min-width: 0;
  text-align: center;

  &-icon {
    color: inherit;
  }

  &-value {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: v-bind(color);
    line-height: 1;
  }

  &-label {
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
  }

  &-skeleton {
    border-radius: var(--radius-sm);
    background: linear-gradient(90deg, var(--color-border) 25%, rgba(255,255,255,0.6) 50%, var(--color-border) 75%);
    background-size: 200% 100%;
    animation: kpiShimmer 1.4s infinite;

    &--icon  { width: 1.5rem; height: 1.5rem; border-radius: 50%; }
    &--value { width: 3rem; height: 1.6rem; }
    &--label { width: 5rem; height: 0.85rem; }
  }

  @keyframes kpiShimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
}
</style>

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

function hexToRgb(hex) {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

function colorToRgb(color) {
  if (color.startsWith('#')) return hexToRgb(color)
  // For CSS vars like var(--brand-dark-green) use a fallback
  return '11, 151, 74'
}

const bgColor = computed(() => `rgba(${colorToRgb(props.color)}, 0.08)`)
const borderColor = computed(() => `rgba(${colorToRgb(props.color)}, 0.2)`)
</script>

<style lang="scss">
.DashboardKpiCard {
  background: v-bind(bgColor);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid v-bind(borderColor);
  border-radius: var(--radius-lg);
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

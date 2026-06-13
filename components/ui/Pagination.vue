<template>
  <div v-if="totalPages > 1" class="Pagination" role="navigation" aria-label="דפדוף בין עמודים">
    <!-- Prev (visually right in RTL) -->
    <button
      type="button"
      class="Pagination-nav"
      :disabled="modelValue <= 1"
      aria-label="עמוד קודם"
      @click="go(modelValue - 1)"
    >
      <UiIcon name="chevron_right" size="sm" />
    </button>

    <!-- Page numbers -->
    <template v-for="item in pages" :key="item">
      <span v-if="item === '...'" class="Pagination-ellipsis">…</span>
      <button
        v-else
        type="button"
        class="Pagination-page"
        :class="{ 'Pagination-page--active': item === modelValue }"
        :aria-current="item === modelValue ? 'page' : undefined"
        @click="go(item)"
      >{{ item }}</button>
    </template>

    <!-- Next (visually left in RTL) -->
    <button
      type="button"
      class="Pagination-nav"
      :disabled="modelValue >= totalPages"
      aria-label="עמוד הבא"
      @click="go(modelValue + 1)"
    >
      <UiIcon name="chevron_left" size="sm" />
    </button>
  </div>
</template>

<script setup>
defineOptions({ name: 'Pagination' })

const props = defineProps({
  total: { type: Number, required: true },
  pageSize: { type: Number, default: 8 },
  modelValue: { type: Number, default: 1 },
})
const emit = defineEmits(['update:modelValue'])

const totalPages = computed(() => Math.ceil(props.total / props.pageSize))

const pages = computed(() => {
  const cur = props.modelValue
  const last = totalPages.value
  const set = new Set([1, last, cur, cur - 1, cur + 1].filter(n => n >= 1 && n <= last))
  const sorted = [...set].sort((a, b) => a - b)
  const result = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('...')
    result.push(sorted[i])
  }
  return result
})

function go(page) {
  if (page < 1 || page > totalPages.value) return
  emit('update:modelValue', page)
}
</script>

<style lang="scss">
.Pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);

  &-nav,
  &-page {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2rem;
    height: 2rem;
    padding: 0 0.25rem;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    color: var(--color-text);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;

    &:hover:not(:disabled):not(.Pagination-page--active) {
      background: var(--light-bg);
      border-color: var(--brand-dark-green);
    }

    &:disabled {
      opacity: 0.35;
      cursor: default;
    }
  }

  &-page--active {
    background: var(--brand-dark-green);
    border-color: var(--brand-dark-green);
    color: #fff;
    font-weight: 700;
    cursor: default;
  }

  &-ellipsis {
    min-width: 2rem;
    height: 2rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-light);
    font-size: var(--font-size-sm);
    user-select: none;
  }
}
</style>

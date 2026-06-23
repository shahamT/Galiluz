<template>
  <div v-if="totalPages > 1" class="UiPaginator">
    <button
      type="button"
      class="UiPaginator-btn"
      :disabled="page <= 1"
      @click="$emit('update:page', page - 1)"
    >
      <UiIcon name="chevron_right" size="sm" />
      הקודם
    </button>
    <span class="UiPaginator-info">עמוד {{ page }} מתוך {{ totalPages }}</span>
    <button
      type="button"
      class="UiPaginator-btn"
      :disabled="page >= totalPages"
      @click="$emit('update:page', page + 1)"
    >
      הבא
      <UiIcon name="chevron_left" size="sm" />
    </button>
  </div>
</template>

<script setup>
defineOptions({ name: 'UiPaginator' })

const props = defineProps({
  page: { type: Number, required: true },
  total: { type: Number, default: 0 },
  pageSize: { type: Number, default: 10 },
})
defineEmits(['update:page'])

const totalPages = computed(() => Math.max(1, Math.ceil((props.total || 0) / props.pageSize)))
</script>

<style lang="scss">
.UiPaginator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  margin-top: var(--spacing-sm);

  &-btn {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--brand-dark-green);
    font-family: var(--font-family-body);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, opacity 0.15s;

    &:not(:disabled):hover { background: var(--light-bg); border-color: var(--brand-dark-green); }
    &:disabled { opacity: 0.4; cursor: default; }
  }

  &-info { font-size: var(--font-size-sm); color: var(--color-text-light); }
}
</style>

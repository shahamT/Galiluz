<template>
  <Teleport to="body">
    <div class="CategorySelectDropdown-overlay" @click.self="emit('close')">
      <div class="CategorySelectDropdown-panel">
        <div class="CategorySelectDropdown-header">
          <span class="CategorySelectDropdown-title">בחרו קטגוריה</span>
          <button type="button" class="CategorySelectDropdown-close" @click="emit('close')">
            <UiIcon name="close" size="md" />
          </button>
        </div>
        <div class="CategorySelectDropdown-body">
          <div
            v-for="group in visibleGroups"
            :key="group.id"
            class="CategorySelectDropdown-group"
          >
            <div class="CategorySelectDropdown-groupLabel">{{ group.label }}</div>
            <div class="CategorySelectDropdown-pills">
              <UiCategoryPill
                v-for="catId in group.categoryIds"
                :key="catId"
                :category="EVENT_CATEGORIES[catId]"
                :category-id="catId"
                :is-selected="catId === selectedId"
                @click="handleSelect(catId)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { EVENT_CATEGORIES, CATEGORY_GROUPS } from '~/consts/events.const.js'

defineOptions({ name: 'FormCategorySelectDropdown' })

const props = defineProps({
  selectedId: { type: String, default: '' },
  excludeIds: { type: Array, default: () => [] },
})
const emit = defineEmits(['select', 'close'])

const visibleGroups = computed(() =>
  CATEGORY_GROUPS.map(g => ({
    ...g,
    categoryIds: g.categoryIds.filter(id => !props.excludeIds.includes(id)),
  })).filter(g => g.categoryIds.length > 0)
)

function handleSelect(catId) {
  emit('select', catId)
  emit('close')
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.CategorySelectDropdown {
  &-overlay {
    position: fixed;
    inset: 0;
    z-index: 1400;
    background: var(--modal-backdrop-bg, rgba(0,0,0,0.5));
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-lg);

    @include mobile {
      padding: 0;
      align-items: stretch;
    }
  }

  &-panel {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 520px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    @include mobile {
      max-width: none;
      max-height: none;
      height: 100%;
      border-radius: 0;
    }
  }

  &-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  &-title {
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-close {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
    padding: 0;
    display: flex;
    &:hover { color: var(--color-text); }
  }

  &-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    direction: rtl;
  }

  &-group { display: flex; flex-direction: column; gap: var(--spacing-xs); }

  &-groupLabel {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  &-pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }
}
</style>

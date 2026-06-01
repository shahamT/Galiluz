<template>
  <div class="CategoryPicker">
    <div
      v-for="group in CATEGORY_GROUPS"
      :key="group.id"
      class="CategoryPicker-group"
    >
      <div class="CategoryPicker-groupLabel">{{ group.label }}</div>
      <div class="CategoryPicker-chips">
        <button
          v-for="catId in group.categoryIds"
          :key="catId"
          type="button"
          class="CategoryPicker-chip"
          :class="{ 'CategoryPicker-chip--selected': modelValue === catId }"
          :style="modelValue === catId ? { background: EVENT_CATEGORIES[catId]?.color + '22', borderColor: EVENT_CATEGORIES[catId]?.color } : {}"
          @click="emit('update:modelValue', catId)"
        >
          <span
            class="CategoryPicker-dot"
            :style="{ background: EVENT_CATEGORIES[catId]?.color }"
          />
          {{ EVENT_CATEGORIES[catId]?.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { CATEGORY_GROUPS, EVENT_CATEGORIES } from '~/consts/events.const.js'

defineOptions({ name: 'CategoryPicker' })
defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.CategoryPicker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);

  &-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  &-groupLabel {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-light);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }

  &-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm-lg);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-background);
    color: var(--color-text);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    white-space: nowrap;

    &:hover {
      border-color: var(--color-text-muted);
    }

    &--selected {
      font-weight: 600;
    }
  }

  &-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
}
</style>

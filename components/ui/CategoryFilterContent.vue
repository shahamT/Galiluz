<template>
  <div class="CategoryFilterContent">
    <div
      v-for="group in categoriesByGroup"
      :key="group.id"
      class="CategoryFilterContent-group"
    >
      <div class="CategoryFilterContent-groupHeader">
        <h3 class="CategoryFilterContent-groupTitle">{{ group.label }}</h3>
        <button
          type="button"
          class="CategoryFilterContent-groupToggleButton"
          :aria-label="isGroupFullySelected(group) ? ariaRemoveAllGroup : ariaSelectAllGroup"
          @click="handleGroupToggleAll(group)"
        >
          {{ isGroupFullySelected(group) ? REMOVE_ALL_GROUP : SELECT_ALL_GROUP }}
        </button>
      </div>
      <UiCategoryPill
        v-for="item in group.categories"
        :key="item.id"
        :category="item.category"
        :category-id="item.id"
        :is-selected="selectedList.includes(item.id)"
        @click="handleToggleCategory(item.id)"
      />
    </div>
  </div>
</template>

<script setup>
import { CATEGORY_GROUPS } from '~/consts/events.const'

defineOptions({ name: 'CategoryFilterContent' })

const props = defineProps({
  categories: {
    type: Object,
    default: () => ({}),
  },
  modelValue: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:modelValue'])

const SELECT_ALL_GROUP = 'בחרו הכל'
const REMOVE_ALL_GROUP = 'הסירו הכל'
const ariaSelectAllGroup = 'בחר את כל הקטגוריות בקבוצה'
const ariaRemoveAllGroup = 'הסר את כל הקטגוריות בקבוצה'

const selectedList = computed(() => props.modelValue ?? [])

const categoriesList = computed(() => props.categories ?? {})

const categoriesByGroup = computed(() => {
  const categories = categoriesList.value
  return CATEGORY_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    categories: group.categoryIds
      .filter((id) => categories[id])
      .map((id) => ({ id, category: categories[id] })),
  })).filter((group) => group.categories.length > 0)
})

function isGroupFullySelected(group) {
  return group.categories.every((item) => selectedList.value.includes(item.id))
}

function handleGroupToggleAll(group) {
  const selected = [...selectedList.value]
  const allSelected = group.categories.every((item) => selected.includes(item.id))
  group.categories.forEach((item) => {
    const idx = selected.indexOf(item.id)
    if (allSelected && idx > -1) {
      selected.splice(idx, 1)
    } else if (!allSelected && idx === -1) {
      selected.push(item.id)
    }
  })
  emit('update:modelValue', selected)
}

function handleToggleCategory(categoryId) {
  const selected = [...selectedList.value]
  const idx = selected.indexOf(categoryId)
  if (idx > -1) {
    selected.splice(idx, 1)
  } else {
    selected.push(categoryId)
  }
  emit('update:modelValue', selected)
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.CategoryFilterContent {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  align-items: stretch;
  direction: rtl;

  &-group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md);
    row-gap: calc((var(--spacing-sm) + var(--spacing-md)) / 2);

    &:not(:first-child) {
      border-top: 1px solid var(--color-border);
      padding-top: var(--spacing-sm);
      margin-top: var(--spacing-xs);
    }
  }

  &-groupHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    margin-bottom: var(--spacing-md);
    gap: var(--spacing-sm);
  }

  &-groupTitle {
    flex: 1;
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-text-light);
    text-align: start;
  }

  &-groupToggleButton {
    flex-shrink: 0;
    background: none;
    border: none;
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--brand-dark-green);
    cursor: pointer;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 0.85;
      text-decoration: underline;
    }
  }
}
</style>

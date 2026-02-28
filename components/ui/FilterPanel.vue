<template>
  <div class="FilterPanel">
    <div
      class="FilterPanel-tabs"
      role="tablist"
      aria-label="סינון"
    >
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'categories'"
        :class="{ 'FilterPanel-tab--active': activeTab === 'categories' }"
        class="FilterPanel-tab"
        @click="activeTab = 'categories'"
      >
        {{ categoriesTabLabel }}
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'regions'"
        :class="{ 'FilterPanel-tab--active': activeTab === 'regions' }"
        class="FilterPanel-tab"
        @click="activeTab = 'regions'"
      >
        {{ regionsTabLabel }}
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'hours'"
        :class="{ 'FilterPanel-tab--active': activeTab === 'hours' }"
        class="FilterPanel-tab"
        @click="activeTab = 'hours'"
      >
        {{ UI_TEXT.hoursFilter }}
      </button>
    </div>
    <div class="FilterPanel-panels">
      <div
        v-show="activeTab === 'categories'"
        role="tabpanel"
        class="FilterPanel-panel FilterPanel-panel--categories"
      >
        <UiCategoryFilterContent
          :categories="categoriesList"
          :model-value="selectedCategoriesList"
          @update:model-value="handleCategoriesUpdate"
        />
      </div>
      <div
        v-show="activeTab === 'regions'"
        role="tabpanel"
        class="FilterPanel-panel FilterPanel-panel--regions"
      >
        <UiAreaFilterMap
          :model-value="selectedRegionsList"
          @update:model-value="handleRegionsUpdate"
        />
      </div>
      <div
        v-show="activeTab === 'hours'"
        role="tabpanel"
        class="FilterPanel-panel FilterPanel-panel--hours"
      >
        <UiHoursFilterPanel />
      </div>
    </div>
    <footer class="FilterPanel-footer">
      <button
        type="button"
        class="FilterPanel-clearAllButton"
        :disabled="!hasAnyFilter"
        @click="handleClearAllFilters"
      >
        <UiIcon name="close" size="sm" class="FilterPanel-clearButtonIcon" />
        {{ resetButtonText }}
      </button>
      <button
        type="button"
        class="FilterPanel-doneButton"
        @click="$emit('close')"
      >
        <UiIcon name="check" size="sm" class="FilterPanel-doneButtonIcon" />
        {{ doneButtonText }}
      </button>
    </footer>
  </div>
</template>

<script setup>
import { UI_TEXT, MINUTES_PER_DAY } from '~/consts/calendar.const'
import { CATEGORY_GROUPS } from '~/consts/events.const'

defineOptions({ name: 'FilterPanel' })

const props = defineProps({
  categories: {
    type: Object,
    default: () => ({}),
  },
  selectedCategoriesCount: {
    type: Number,
    default: 0,
  },
  hoursFilterLabel: {
    type: String,
    default: () => UI_TEXT.hoursFilterAll,
  },
})

defineEmits(['close'])

// data
const activeTab = ref('categories')
const calendarStore = useCalendarStore()
const { selectedCategories, selectedRegions, timeFilterStart, timeFilterEnd } = storeToRefs(calendarStore)

const resetButtonText = UI_TEXT.resetFilter
const doneButtonText = UI_TEXT.filterDone

const SELECT_ALL_GROUP = 'בחרו הכל'
const REMOVE_ALL_GROUP = 'הסירו הכל'
const ariaSelectAllGroup = 'בחר את כל הקטגוריות בקבוצה'
const ariaRemoveAllGroup = 'הסר את כל הקטגוריות בקבוצה'

// computed
const categoriesTabLabel = computed(() => UI_TEXT.categoriesFilter)
const regionsTabLabel = computed(() => UI_TEXT.regionsFilter)

const selectedCategoriesList = computed(() => selectedCategories.value ?? [])
const selectedRegionsList = computed(() => selectedRegions.value ?? [])
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

const isTimeFilterActive = computed(() => {
  return timeFilterStart.value !== 0 || timeFilterEnd.value !== MINUTES_PER_DAY
})

const hasAnyFilter = computed(() => {
  return (
    selectedCategoriesList.value.length > 0 ||
    selectedRegionsList.value.length > 0 ||
    isTimeFilterActive.value
  )
})

// methods
function isGroupFullySelected(group) {
  return group.categories.every((item) => selectedCategoriesList.value.includes(item.id))
}

function handleGroupToggleAll(group) {
  const selected = [...selectedCategoriesList.value]
  const allSelected = group.categories.every((item) => selected.includes(item.id))
  group.categories.forEach((item) => {
    const isSelected = selected.includes(item.id)
    if (allSelected && isSelected) {
      calendarStore.toggleCategory(item.id)
    } else if (!allSelected && !isSelected) {
      calendarStore.toggleCategory(item.id)
    }
  })
}

function handleToggleCategory(categoryId) {
  calendarStore.toggleCategory(categoryId)
}

function handleClearAllFilters() {
  calendarStore.resetFilter()
}

function handleCategoriesUpdate(newSelectedIds) {
  selectedCategories.value = newSelectedIds ?? []
}

function handleRegionsUpdate(newRegions) {
  selectedRegions.value = newRegions ?? []
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.FilterPanel {
  display: flex;
  flex-direction: column;
  height: 100%;

  @include mobile {
    min-height: 0;
  }

  &-tabs {
    display: flex;
    gap: 0;
    border-bottom: 2px solid var(--color-border);
    overflow: hidden;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    flex-shrink: 0;

    @include mobile {
      border-radius: 0;
    }
  }

  &-tab {
    flex: 1;
    padding: var(--spacing-sm) var(--spacing-sm);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-light);
    background-color: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;

    &:hover:not(.FilterPanel-tab--active) {
      color: var(--color-text);
    }

    &--active {
      background-color: var(--brand-dark-green);
      color: var(--chip-text-white);
      border-bottom-color: var(--brand-dark-green);
    }

    @include mobile {
      padding: var(--spacing-md) var(--spacing-sm);
      font-size: var(--font-size-md);
    }
  }

  &-panels {
    padding: var(--spacing-lg);
    min-height: 320px;
    overflow-y: auto;
    overflow-x: hidden;
    direction: ltr;

    @include desktop {
      flex: 1;
      min-height: 0;
      min-width: 0;
    }

    @include mobile {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }
  }

  &-panel {
    direction: rtl;

    &--categories {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-lg);
      align-items: stretch;
    }

    &--regions {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
    }

    &--hours {
      padding: var(--spacing-sm) 0;
    }
  }

  &-footer {
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;
    padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-md) var(--spacing-lg);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  &-clearAllButton {
    flex: 1;
    padding: 0 var(--spacing-md);
    height: var(--control-height);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--brand-dark-green);
    background-color: transparent;
    border: 2px solid var(--brand-dark-green);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);

    &:hover:not(:disabled) {
      background-color: var(--brand-dark-green);
      color: var(--chip-text-white);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }

    @include mobile {
      height: var(--section-header-height);
      font-size: var(--font-size-md);
    }
  }

  &-clearButtonIcon {
    flex-shrink: 0;
  }

  &-doneButton {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    flex: 1;
    padding: 0 var(--spacing-md);
    height: var(--control-height);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--chip-text-white);
    background-color: var(--brand-dark-green);
    border: 2px solid var(--brand-dark-green);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 0.9;
    }

    @include mobile {
      height: var(--section-header-height);
      font-size: var(--font-size-md);
    }
  }

  &-doneButtonIcon {
    flex-shrink: 0;
  }
}
</style>

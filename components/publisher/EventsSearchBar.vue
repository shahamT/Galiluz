<template>
  <div class="EventsSearchBar">
    <div class="EventsSearchBar-filters" role="group">
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        class="EventsSearchBar-segment"
        :class="{ 'EventsSearchBar-segment--active': modelValue === opt.value }"
        @click="emit('update:modelValue', opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>
    <div class="EventsSearchBar-search">
      <UiIcon name="search" size="sm" class="EventsSearchBar-searchIcon" />
      <input
        :value="search"
        type="search"
        class="EventsSearchBar-input"
        placeholder="חיפוש אירוע..."
        @input="emit('update:search', $event.target.value)"
      />
    </div>
    <button type="button" class="EventsSearchBar-addBtn" @click="emit('add-event')">
      <UiIcon name="add" size="sm" />
      אירוע חדש
    </button>
  </div>
</template>

<script setup>
defineOptions({ name: 'EventsSearchBar' })
defineProps({
  modelValue: { type: String, default: 'future' },
  search: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'update:search', 'add-event'])

const options = [
  { value: 'past',   label: 'הסתיימו' },
  { value: 'future', label: 'עתידיים' },
  { value: 'all',    label: 'כל האירועים' },
]
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.EventsSearchBar {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);

  @include mobile {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "search addBtn"
      "filters filters";
    gap: var(--spacing-sm);
    align-items: stretch;
  }

  &-search {
    position: relative;
    flex: 1;

    @include mobile {
      grid-area: search;
    }
  }

  &-searchIcon {
    position: absolute;
    right: var(--spacing-sm);
    top: 50%;
    transform: translateY(-50%);
    color: var(--brand-dark-green);
    pointer-events: none;
  }

  &-input {
    width: 100%;
    height: var(--control-height);
    padding-top: 0;
    padding-bottom: 0;
    padding-right: 2.2rem;
    padding-left: var(--spacing-sm);

    @include mobile { height: var(--section-header-height); }
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    color: var(--color-text);
    background: var(--color-background);
    direction: rtl;
    transition: border-color 0.15s;
    box-sizing: border-box;

    &::placeholder { color: var(--color-text-muted); }
    &:focus {
      outline: none;
      border-color: var(--brand-dark-green);
    }

    &::-webkit-search-cancel-button {
      cursor: pointer;
      margin-left: var(--spacing-xs);
    }
  }

  &-filters {
    display: flex;
    align-items: stretch;
    height: var(--control-height);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: rgba(255, 255, 255, 0.7);
    flex-shrink: 0;
    padding: 2px;
    gap: 1px;

    @include mobile {
      grid-area: filters;
      height: var(--section-header-height);
      width: 100%;
    }
  }

  &-segment {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 var(--spacing-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: var(--font-family-body);
    color: var(--color-text-light);
    background: transparent;
    border: none;
    border-radius: calc(var(--radius-md) - 2px);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s, box-shadow 0.15s;

    &:hover:not(.EventsSearchBar-segment--active) {
      background: rgba(0, 0, 0, 0.05);
    }

    &--active {
      background: var(--color-background);
      color: var(--brand-dark-green);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }

    @include mobile {
      flex: 1;
      padding: 0 var(--spacing-sm);
    }
  }

  &-addBtn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    height: var(--control-height);
    padding: 0 var(--spacing-lg);
    background: var(--brand-dark-green);
    color: #fff;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: var(--font-family-body);
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: opacity 0.2s;

    &:hover { opacity: 0.9; }

    @include mobile {
      grid-area: addBtn;
      width: auto;
      height: var(--section-header-height);
      justify-content: center;
    }
  }
}
</style>

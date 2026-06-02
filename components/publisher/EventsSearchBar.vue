<template>
  <div class="EventsSearchBar">
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
  </div>
</template>

<script setup>
defineOptions({ name: 'EventsSearchBar' })
defineProps({
  modelValue: { type: String, default: 'future' },
  search: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'update:search'])

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
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-sm);
  }

  &-search {
    position: relative;
    flex: 1;

    @include mobile { width: 100%; }
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
    background: var(--light-bg);
    flex-shrink: 0;

    @include mobile {
      height: var(--control-height);
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
    color: var(--brand-dark-green);
    background: transparent;
    border: none;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;

    &:hover:not(.EventsSearchBar-segment--active) {
      background: var(--day-cell-hover-bg);
    }

    &--active {
      background: var(--brand-dark-green);
      color: var(--chip-text-white);
    }

    @include mobile {
      flex: 1;
      padding: 0 var(--spacing-sm);
    }
  }
}
</style>

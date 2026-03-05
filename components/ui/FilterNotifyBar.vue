<template>
  <Transition name="FilterNotifyBar">
    <aside
      v-if="visible"
      class="FilterNotifyBar"
      role="alert"
      aria-live="polite"
    >
      <div class="FilterNotifyBar-texts">
        <p class="FilterNotifyBar-message">
          {{ message }}
        </p>
        <p v-if="filterSummary" class="FilterNotifyBar-summary">
          {{ filterSummary }}
        </p>
      </div>
      <div class="FilterNotifyBar-buttons">
        <button
          type="button"
          class="FilterNotifyBar-button FilterNotifyBar-button--reset"
          @click="handleReset"
        >
          {{ resetLabel }}
        </button>
        <button
          type="button"
          class="FilterNotifyBar-button FilterNotifyBar-button--change"
          @click="handleChangeFilters"
        >
          {{ changeLabel }}
        </button>
        <button
          type="button"
          class="FilterNotifyBar-closeButton"
          :aria-label="closeAriaLabel"
          @click="handleClose"
        >
          <UiIcon name="close" size="sm" />
        </button>
      </div>
    </aside>
  </Transition>
</template>

<script setup>
import { UI_TEXT } from '~/consts/calendar.const'

defineOptions({ name: 'FilterNotifyBar' })

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  filterSummary: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['reset', 'change-filters', 'close'])

// computed
const message = UI_TEXT.activeFiltersNotifyMessage
const resetLabel = UI_TEXT.activeFiltersReset
const changeLabel = UI_TEXT.activeFiltersChange
const closeAriaLabel = 'סגור'

// methods
function handleReset() {
  emit('reset')
}

function handleChangeFilters() {
  emit('change-filters')
}

function handleClose() {
  emit('close')
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.FilterNotifyBar {
  position: fixed;
  bottom: var(--spacing-md);
  left: 50%;
  transform: translateX(-50%);
  z-index: calc(var(--z-index-modal) - 1);
  width: max-content;
  max-width: calc(100vw - 2 * var(--spacing-md));
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-2xl);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  direction: rtl;

  @include mobile {
    left: 50%;
    right: auto;
    width: calc(100dvw - 2 * var(--spacing-sm));
    transform: translateX(-50%);
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
  }
}

.FilterNotifyBar-texts {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xs);
  text-align: right;

  @include mobile {
    align-self: stretch;
    min-width: 0;
    align-items: flex-start;
  }
}

.FilterNotifyBar-message,
.FilterNotifyBar-summary {
  @include mobile {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
  }
}

.FilterNotifyBar-message {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);

  @include mobile {
    font-size: var(--font-size-lg);
  }
}

.FilterNotifyBar-summary {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 400;
  color: var(--color-text-light);

  @include mobile {
    font-size: var(--font-size-base);
  }
}

.FilterNotifyBar-buttons {
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-sm);

  @include mobile {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-sm);
  }
}

.FilterNotifyBar-button {
  padding: 0 var(--spacing-md);
  height: var(--control-height);
  font-size: var(--font-size-sm);
  font-weight: 600;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;
  border: 2px solid transparent;

  @include mobile {
    height: var(--section-header-height);
    font-size: var(--font-size-md);
  }

  &--reset {
    color: var(--brand-dark-green);
    background-color: transparent;
    border-color: var(--brand-dark-green);

    &:hover {
      background-color: var(--brand-dark-green);
      color: var(--chip-text-white);
    }
  }

  &--change {
    color: var(--chip-text-white);
    background-color: var(--brand-dark-green);
    border-color: var(--brand-dark-green);

    &:hover {
      opacity: 0.9;
    }
  }
}

.FilterNotifyBar-closeButton {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--control-height);
  height: var(--control-height);
  padding: 0;
  border: none;
  border-radius: 50%;
  background-color: var(--light-bg);
  color: var(--brand-dark-green);
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: var(--day-cell-hover-bg);
  }

  @include mobile {
    position: absolute;
    top: var(--spacing-sm);
    inset-inline-end: var(--spacing-sm);
    width: 2.25rem;
    height: 2.25rem;
  }
}

.FilterNotifyBar-enter-active,
.FilterNotifyBar-leave-active {
  transition: transform 0.5s ease, opacity 0.5s ease;
}

.FilterNotifyBar-enter-from,
.FilterNotifyBar-leave-to {
  transform: translate(-50%, 100%);
  opacity: 0;
}

.FilterNotifyBar-enter-to,
.FilterNotifyBar-leave-from {
  transform: translate(-50%, 0);
  opacity: 1;
}

@include mobile {
  .FilterNotifyBar-enter-from,
  .FilterNotifyBar-leave-to {
    transform: translate(-50%, 100%);
  }

  .FilterNotifyBar-enter-to,
  .FilterNotifyBar-leave-from {
    transform: translate(-50%, 0);
  }
}
</style>

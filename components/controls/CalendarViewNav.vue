<template>
  <nav class="CalendarViewNav" :class="{ 'CalendarViewNav--mobile': isMobile, 'CalendarViewNav--small': isSmallMobile, 'CalendarViewNav--monthView': viewMode === 'month' }" role="navigation" aria-label="Calendar view navigation">
    <div class="CalendarViewNav-gridWrapper">
      <div class="CalendarViewNav-row">
        <div class="CalendarViewNav-rowLeft">
          <div class="CalendarViewNav-viewToggle" role="group" aria-label="View mode">
            <button
              type="button"
              class="CalendarViewNav-viewToggleSegment"
              :class="{ 'CalendarViewNav-viewToggleSegment--active': viewMode === 'month' }"
              :aria-label="monthSegmentAriaLabel"
              :aria-pressed="viewMode === 'month'"
              @click="handleViewSegmentClick('month')"
            >
              <UiIcon name="calendar_month" size="sm" class="CalendarViewNav-viewToggleIcon" />
              <span class="CalendarViewNav-viewToggleText">{{ viewMonthlyLabel }}</span>
            </button>
            <button
              type="button"
              class="CalendarViewNav-viewToggleSegment"
              :class="{ 'CalendarViewNav-viewToggleSegment--active': viewMode === 'day' }"
              :aria-label="daySegmentAriaLabel"
              :aria-pressed="viewMode === 'day'"
              @click="handleViewSegmentClick('day')"
            >
              <UiIcon name="view_agenda" size="sm" class="CalendarViewNav-viewToggleIcon" />
              <span class="CalendarViewNav-viewToggleText">{{ viewDailyLabel }}</span>
            </button>
          </div>
        </div>
        <div class="CalendarViewNav-rowCenter">
          <button
            v-if="isMobile"
            type="button"
            class="CalendarViewNav-navButton CalendarViewNav-navButton--prev"
            :disabled="prevDisabled"
            :aria-label="prevAriaLabel"
            @click="handlePrev"
          >
            <UiIcon name="chevron_right" size="md" />
          </button>
          <div class="CalendarViewNav-monthTriggerWrapper">
            <button
              ref="monthTriggerButtonRef"
              type="button"
              class="CalendarViewNav-monthTrigger"
              aria-label="Select month and year"
              @click="toggleMonthYearPicker"
            >
              <span class="CalendarViewNav-month">{{ monthYear }}</span>
              <UiIcon name="expand_more" size="sm" class="CalendarViewNav-chevron" />
            </button>
            <UiMonthYearPopup
              v-if="isMonthYearPickerOpen && !isMobile"
              :current-date="currentDate"
              :trigger-element="monthTriggerButtonRef"
              @close="closeMonthYearPicker"
              @select="handleMonthYearSelect"
              @year-change="handleYearChange"
            />
            <UiMonthYearModal
              v-if="isMonthYearPickerOpen && isMobile"
              :current-date="currentDate"
              @close="closeMonthYearPicker"
              @select="handleMonthYearSelect"
              @year-change="handleYearChange"
            />
          </div>
          <button
            v-if="isMobile"
            type="button"
            class="CalendarViewNav-navButton CalendarViewNav-navButton--next"
            :aria-label="nextAriaLabel"
            @click="handleNext"
          >
            <UiIcon name="chevron_left" size="md" />
          </button>
        </div>
        <div class="CalendarViewNav-filterTriggerWrapper">
          <button
            ref="filterTriggerRef"
            type="button"
            class="CalendarViewNav-filterButton"
            :class="{ 'CalendarViewNav-filterButton--active': isFilterActive || isFilterPopupOpen }"
            :aria-label="filterButtonLabel"
            :aria-expanded="isFilterPopupOpen"
            @click="toggleFilterPopup"
          >
            <UiIcon name="filter_list" size="sm" class="CalendarViewNav-filterButtonIcon" />
            <span class="CalendarViewNav-filterButtonText">{{ filterButtonLabel }}</span>
          </button>
          <UiFilterPopup
            v-if="isFilterPopupOpen && !isMobile"
            :trigger-element="filterTriggerRef"
            :categories="categories"
            :selected-categories-count="selectedCategoriesCount"
            :hours-filter-label="hoursFilterLabel"
            @close="closeFilterPopup"
          />
          <UiFilterModal
            v-if="isFilterPopupOpen && isMobile"
            :categories="categories"
            :selected-categories-count="selectedCategoriesCount"
            :hours-filter-label="hoursFilterLabel"
            @close="closeFilterPopup"
          />
        </div>
      </div>
    </div>
    <div class="CalendarViewNav-separator"></div>
  </nav>
</template>

<script setup>
import { UI_TEXT } from '~/consts/calendar.const'
import { MOBILE_BREAKPOINT, SMALL_MOBILE_BREAKPOINT } from '~/consts/ui.const'
import { useCalendarViewNav } from '~/composables/useCalendarViewNav'

defineOptions({ name: 'CalendarViewNav' })

const props = defineProps({
  viewMode: {
    type: String,
    required: true,
    validator: (value) => ['month', 'day'].includes(value),
  },
  monthYear: {
    type: String,
    default: '',
  },
  currentDate: {
    type: Object,
    default: () => ({
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
    }),
  },
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
  filterButtonLabel: {
    type: String,
    default: () => UI_TEXT.filterButtonLabel,
  },
  isFilterActive: {
    type: Boolean,
    default: false,
  },
  prevDisabled: {
    type: Boolean,
    default: false,
  },
  prevAriaLabel: {
    type: String,
    default: 'Previous',
  },
  nextAriaLabel: {
    type: String,
    default: 'Next',
  },
})

const emit = defineEmits([
  'select-month-year',
  'year-change',
  'view-change',
  'prev',
  'next',
])

const isMobile = useScreenWidth(MOBILE_BREAKPOINT)
const isSmallMobile = useScreenWidth(SMALL_MOBILE_BREAKPOINT)

const {
  isMonthYearPickerOpen,
  monthTriggerButtonRef,
  isFilterPopupOpen,
  filterTriggerRef,
  viewMonthlyLabel,
  viewDailyLabel,
  monthSegmentAriaLabel,
  daySegmentAriaLabel,
  toggleMonthYearPicker,
  closeMonthYearPicker,
  toggleFilterPopup,
  closeFilterPopup,
  handleMonthYearSelect,
  handleYearChange,
  handleViewSegmentClick,
  handlePrev,
  handleNext,
} = useCalendarViewNav(props, emit)
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.CalendarViewNav {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  gap: var(--spacing-md);

  &-gridWrapper {
    width: 100%;
    min-width: 0;
  }

  &-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--spacing-md);
    direction: rtl;
    margin-bottom: var(--spacing-sm);
    min-width: 0;

    @include mobile {
      margin-bottom: 0;
    }
  }

  &-rowLeft {
    justify-self: start;
  }

  &-rowCenter {
    justify-self: center;
  }

  &-filterTriggerWrapper {
    justify-self: end;
    position: relative;
    min-width: 0;
  }

  @include mobile {
    &-gridWrapper {
      max-width: var(--popup-max-width);
      margin: 0 auto;
    }

    &-row {
      grid-template-columns: auto 1fr;
      grid-template-rows: auto auto;
      gap: var(--spacing-sm);
    }

    &-rowLeft {
      grid-column: 1;
      grid-row: 1;
      justify-self: start;
    }

    &-filterTriggerWrapper {
      grid-column: 2;
      grid-row: 1;
      justify-self: stretch;
    }

    &-rowCenter {
      grid-column: 1 / -1;
      grid-row: 2;
      justify-self: stretch;
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: var(--spacing-sm);
    }

    &-monthTriggerWrapper {
      min-width: 0;
    }

    &-monthTrigger {
      width: 100% !important;
      max-width: 100%;
    }

    &-filterButton {
      width: 100%;
      min-width: unset;
    }

    &-viewToggleSegment {
      padding: 0 var(--spacing-sm);
    }
  }

  @include mobile-narrow {
    &-viewToggleText {
      display: none;
    }
  }

  &-navButton {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--control-height);
    height: var(--control-height);
    border-radius: var(--radius-md);
    background-color: var(--light-bg);
    border: none;
    color: var(--brand-dark-green);
    cursor: pointer;
    transition: background-color 0.2s ease;
    flex-shrink: 0;

    &:hover:not(:disabled) {
      background-color: var(--day-cell-hover-bg);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }

    @include mobile {
      width: var(--control-height-mobile);
      height: var(--control-height-mobile);

      .Icon {
        font-size: var(--icon-size-md);
      }
    }
  }

  &-separator {
    width: 100%;
    height: 1px;
    background-color: var(--brand-light-green);
  }

  &-monthTriggerWrapper {
    position: relative;
  }

  &-monthTrigger {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    width: 12rem;
    height: var(--control-height);
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--brand-dark-green);
    background-color: var(--light-bg);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: var(--day-cell-hover-bg);
    }

    @include mobile {
      height: var(--control-height-mobile);
      font-size: var(--font-size-base);

      .Icon {
        font-size: var(--icon-size-md);
      }
    }
  }

  &-month {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &-chevron {
    color: var(--brand-dark-green);
    flex-shrink: 0;
  }

  &-filterButton {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    height: var(--control-height);
    min-width: 0;
    max-width: 100%;
    padding: 0 var(--spacing-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--brand-dark-green);
    background-color: var(--light-bg);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;

    @include desktop {
      max-width: 200px;
    }

    &:hover:not(.CalendarViewNav-filterButton--active) {
      background-color: var(--day-cell-hover-bg);
    }

    &--active {
      background-color: var(--brand-dark-green);
      color: var(--chip-text-white);

      .CalendarViewNav-filterButtonIcon {
        color: var(--chip-text-white);
      }
    }

    @include mobile {
      height: var(--control-height-mobile);
      font-size: var(--font-size-base);

      .Icon {
        font-size: var(--icon-size-md);
      }
    }
  }

  &-filterButtonIcon {
    flex-shrink: 0;
  }

  &-filterButtonText {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &-viewToggle {
    display: flex;
    align-items: stretch;
    height: var(--control-height);
    border-radius: var(--radius-md);
    overflow: hidden;
    background-color: var(--light-bg);

    @include mobile {
      height: var(--control-height-mobile);
    }
  }

  &-viewToggleSegment {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: 0 var(--spacing-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--brand-dark-green);
    background-color: transparent;
    border: none;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;

    &:hover:not(.CalendarViewNav-viewToggleSegment--active) {
      background-color: var(--day-cell-hover-bg);
    }

    &--active {
      background-color: var(--brand-dark-green);
      color: var(--chip-text-white);

      .CalendarViewNav-viewToggleIcon {
        color: var(--chip-text-white);
      }
    }

    @include mobile {
      font-size: var(--font-size-base);

      .Icon {
        font-size: var(--icon-size-md);
      }
    }
  }

  &-viewToggleIcon {
    flex-shrink: 0;
  }
}
</style>

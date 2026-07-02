<template>
  <Teleport to="body">
    <Transition name="DatePickerModal" appear>
      <div class="DatePickerModal-overlay" @click.self="emit('close')">
        <div ref="panelEl" class="DatePickerModal-panel" role="dialog" aria-modal="true" :aria-label="title">
          <div class="DatePickerModal-header">
            <span class="DatePickerModal-title">{{ title }}</span>
            <button type="button" class="DatePickerModal-close" aria-label="סגירה" @click="emit('close')">
              <UiIcon name="close" size="md" />
            </button>
          </div>

          <div class="DatePickerModal-nav">
            <!-- RTL: back = right, forward = left -->
            <button
              type="button"
              class="DatePickerModal-navBtn"
              :disabled="!canGoPrev"
              aria-label="חודש קודם"
              @click="goPrev"
            >
              <UiIcon name="chevron_right" size="md" />
            </button>
            <span class="DatePickerModal-month" aria-live="polite">{{ monthTitle }}</span>
            <button type="button" class="DatePickerModal-navBtn" aria-label="חודש הבא" @click="goNext">
              <UiIcon name="chevron_left" size="md" />
            </button>
          </div>

          <div class="DatePickerModal-weekdays" aria-hidden="true">
            <span v-for="(d, i) in HEBREW_WEEKDAYS_SHORT" :key="d" class="DatePickerModal-weekday" :class="{ 'DatePickerModal-weekday--weekend': i >= 5 }">
              {{ d }}
            </span>
          </div>

          <div class="DatePickerModal-grid">
            <template v-for="(cell, i) in gridCells" :key="i">
              <button
                v-if="cell"
                type="button"
                class="DatePickerModal-day"
                :class="{
                  'DatePickerModal-day--selected': cell.iso === modelValue,
                  'DatePickerModal-day--today': cell.iso === todayIso,
                  'DatePickerModal-day--weekend': cell.weekend,
                }"
                :disabled="cell.disabled"
                :data-focus="cell.iso === (modelValue || todayIso) ? '' : undefined"
                :aria-label="cell.label"
                :aria-pressed="cell.iso === modelValue"
                @click="pick(cell.iso)"
              >
                {{ cell.day }}
              </button>
              <span v-else class="DatePickerModal-dayEmpty" />
            </template>
          </div>

          <div class="DatePickerModal-footer">
            <button type="button" class="DatePickerModal-todayBtn" @click="goToday">היום</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { HEBREW_WEEKDAYS_SHORT, HEBREW_WEEKDAYS } from '~/consts/dates.const'

/**
 * Branded in-house date picker — replaces the native <input type="date"> (whose picker can't be
 * opened programmatically on iOS Safari). Centered card on desktop, full-screen sheet on mobile.
 * Value contract matches the native input: ISO YYYY-MM-DD strings in/out, `min` disables earlier
 * days. Tapping a day selects and closes; "היום" jumps the view back to the current month.
 */
defineOptions({ name: 'FormDatePickerModal' })

const props = defineProps({
  modelValue: { type: String, default: '' },
  min: { type: String, default: '' },
  title: { type: String, default: 'בחרו תאריך' },
})
const emit = defineEmits(['update:modelValue', 'close'])

const todayIso = getTodayDateString()

function monthOf(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(iso || '')
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null
}

const minMonth = computed(() => monthOf(props.min))

// Start on the selected date's month (else today's), never before the min month.
const initial = monthOf(props.modelValue) || getCurrentYearMonth()
const view = ref(minMonth.value && isMonthBefore(initial, minMonth.value) ? { ...minMonth.value } : initial)

const monthTitle = computed(() => formatMonthYear(view.value.year, view.value.month))
const canGoPrev = computed(() => {
  if (!minMonth.value) return true
  return !isMonthBefore(getPrevMonth(view.value.year, view.value.month), minMonth.value)
})

function goPrev() {
  const prev = getPrevMonth(view.value.year, view.value.month)
  if (minMonth.value && isMonthBefore(prev, minMonth.value)) return
  view.value = prev
}
function goNext() { view.value = getNextMonth(view.value.year, view.value.month) }
function goToday() { view.value = getCurrentYearMonth() }

const gridCells = computed(() => {
  const { year, month } = view.value
  const lead = new Date(year, month - 1, 1).getDay() // 0 = Sunday; the grid is Sunday-first
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells = Array.from({ length: lead }, () => null)
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const weekday = (lead + day - 1) % 7
    cells.push({
      day,
      iso,
      weekend: weekday >= 5,
      disabled: !!props.min && iso < props.min,
      label: `יום ${HEBREW_WEEKDAYS[weekday]}, ${day} ב${monthTitle.value}`,
    })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
})

function pick(iso) {
  emit('update:modelValue', iso)
  emit('close')
}

// Focus the selected (else today's) day on open; Escape closes.
const panelEl = ref(null)
function onKeydown(e) { if (e.key === 'Escape') emit('close') }
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  nextTick(() => panelEl.value?.querySelector('[data-focus]')?.focus())
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.DatePickerModal {
  &-overlay {
    position: fixed;
    inset: 0;
    z-index: 1400;
    background: var(--modal-backdrop-bg, rgba(0, 0, 0, 0.5));
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-lg);

    @include mobile { padding: 0; align-items: stretch; }
  }

  &-panel {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 352px;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    @include mobile { max-width: none; border-radius: 0; height: 100%; }
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

  &-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md) var(--spacing-lg) var(--spacing-xs);
  }

  &-month {
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--color-text);

    @include mobile { font-size: var(--font-size-lg); }
  }

  &-navBtn {
    width: 2.25rem;
    height: 2.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--brand-dark-green);
    cursor: pointer;
    transition: background 0.15s;

    &:hover:not(:disabled) { background: var(--brand-dark-green-tint-light); }
    &:disabled { color: var(--color-text-muted); opacity: 0.5; cursor: default; }
  }

  &-weekdays,
  &-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    padding: 0 var(--spacing-lg);
  }

  &-weekdays { padding-bottom: var(--spacing-xs); }

  &-weekday {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 2rem;
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-muted);

    &--weekend { color: var(--brand-dark-green); opacity: 0.75; }
  }

  &-grid { padding-bottom: var(--spacing-md); }

  &-day {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid transparent;
    border-radius: var(--radius-full);
    background: transparent;
    font-family: var(--font-family-body);
    font-size: var(--font-size-sm);
    color: var(--color-text);
    cursor: pointer;
    padding: 0;
    transition: background 0.12s, border-color 0.12s;

    @include mobile { font-size: var(--font-size-base); }

    &:hover:not(:disabled) { background: var(--brand-dark-green-tint-light); }

    &--weekend:not(:disabled) { background: var(--light-bg); }

    &--today { border-color: var(--brand-dark-green); font-weight: 700; }

    &--selected {
      background: var(--brand-dark-green) !important;
      border-color: var(--brand-dark-green);
      color: #fff;
      font-weight: 700;
    }

    &:disabled {
      color: var(--color-text-muted);
      opacity: 0.45;
      cursor: default;
      background: transparent;
    }
  }

  &-dayEmpty { aspect-ratio: 1; }

  &-footer {
    display: flex;
    justify-content: center;
    padding: 0 var(--spacing-lg) var(--spacing-md);
    margin-top: auto;
    flex-shrink: 0;

    @include mobile { padding-bottom: calc(var(--spacing-lg) + env(safe-area-inset-bottom, 0px)); }
  }

  &-todayBtn {
    border: 1.5px solid var(--brand-dark-green-tint);
    border-radius: var(--radius-full);
    background: var(--brand-dark-green-tint-light);
    color: var(--brand-dark-green);
    font-family: var(--font-family-body);
    font-size: var(--font-size-sm);
    font-weight: 600;
    padding: var(--spacing-xs) var(--spacing-lg);
    cursor: pointer;
    transition: background 0.15s;

    &:hover { background: var(--brand-dark-green-tint); }

    @include mobile { width: 100%; padding: var(--spacing-sm); font-size: var(--font-size-base); }
  }
}

// Enter/leave: fade backdrop; desktop scales the card in, mobile slides the sheet up.
.DatePickerModal-enter-active,
.DatePickerModal-leave-active {
  transition: opacity 0.18s ease;
  .DatePickerModal-panel { transition: transform 0.18s ease, opacity 0.18s ease; }
}
.DatePickerModal-enter-from,
.DatePickerModal-leave-to {
  opacity: 0;
  .DatePickerModal-panel { transform: scale(0.96); opacity: 0; }
}
@include mobile {
  .DatePickerModal-enter-active .DatePickerModal-panel,
  .DatePickerModal-leave-active .DatePickerModal-panel { transition: transform 0.25s ease; }
  .DatePickerModal-enter-from .DatePickerModal-panel,
  .DatePickerModal-leave-to .DatePickerModal-panel { transform: translateY(100%); opacity: 1; }
}
</style>

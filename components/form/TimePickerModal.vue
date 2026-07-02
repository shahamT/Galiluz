<template>
  <Teleport to="body">
    <Transition name="TimePickerModal" appear>
      <div class="TimePickerModal-overlay" @click.self="emit('close')">
        <div class="TimePickerModal-panel" role="dialog" aria-modal="true" :aria-label="title">
          <div class="TimePickerModal-header">
            <span class="TimePickerModal-title">{{ title }}</span>
            <button type="button" class="TimePickerModal-close" aria-label="סגירה" @click="emit('close')">
              <UiIcon name="close" size="md" />
            </button>
          </div>

          <div class="TimePickerModal-wheels" dir="ltr">
            <div class="TimePickerModal-band" aria-hidden="true" />
            <div class="TimePickerModal-wheelWrap">
              <span class="TimePickerModal-wheelLabel">שעה</span>
              <div ref="hourWheel" class="TimePickerModal-wheel" @scroll="onWheelScroll('h')">
                <button
                  v-for="(h, i) in hourItems"
                  :key="h.value"
                  type="button"
                  class="TimePickerModal-item"
                  :class="{ 'TimePickerModal-item--active': i === hourIdx, 'TimePickerModal-item--disabled': h.disabled }"
                  tabindex="-1"
                  @click="scrollToIdx('h', i)"
                >
                  {{ h.value }}
                </button>
              </div>
            </div>
            <span class="TimePickerModal-colon" aria-hidden="true">:</span>
            <div class="TimePickerModal-wheelWrap">
              <span class="TimePickerModal-wheelLabel">דקות</span>
              <div ref="minuteWheel" class="TimePickerModal-wheel" @scroll="onWheelScroll('m')">
                <button
                  v-for="(m, i) in minuteItems"
                  :key="m.value"
                  type="button"
                  class="TimePickerModal-item"
                  :class="{ 'TimePickerModal-item--active': i === minuteIdx, 'TimePickerModal-item--disabled': m.disabled }"
                  tabindex="-1"
                  @click="scrollToIdx('m', i)"
                >
                  {{ m.value }}
                </button>
              </div>
            </div>
          </div>

          <div class="TimePickerModal-footer">
            <span v-if="durationLabel" class="TimePickerModal-duration">{{ durationLabel }}</span>
            <button type="button" class="TimePickerModal-confirm" @click="confirm">אישור</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
/**
 * Branded time picker — iOS-style snap wheels (hours + minutes in 5-minute steps; an exact
 * off-step minute from existing data is injected into its slot). Bottom sheet on mobile,
 * centered card on desktop; companion to FormDatePickerModal.
 * Value contract: 'HH:mm' strings in/out. `min` (exclusive) disables times at-or-before it —
 * used for "end must be after start"; `durationFrom` shows a live duration hint.
 */
defineOptions({ name: 'FormTimePickerModal' })

const props = defineProps({
  modelValue: { type: String, default: '' },
  min: { type: String, default: '' },
  durationFrom: { type: String, default: '' },
  title: { type: String, default: 'בחרו שעה' },
})
const emit = defineEmits(['update:modelValue', 'close'])

const ITEM_H = 40 // must match --tp-item in the styles

function parseHM(t, fallback = { h: 8, m: 0 }) {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(t || '')
  if (!match) return fallback
  return { h: Math.min(23, Number(match[1])), m: Math.min(59, Number(match[2])) }
}
const pad = (n) => String(n).padStart(2, '0')

const initial = parseHM(props.modelValue)
const minHM = computed(() => (props.min ? parseHM(props.min, null) : null))

// 5-minute steps, plus the exact current minute when it's off-step (so 18:37 stays reachable).
const initialMinuteSteps = (() => {
  const steps = Array.from({ length: 12 }, (_, i) => i * 5)
  if (!steps.includes(initial.m)) steps.push(initial.m)
  return steps.sort((a, b) => a - b)
})()
const maxMinuteStep = initialMinuteSteps[initialMinuteSteps.length - 1]

const hourItems = computed(() =>
  Array.from({ length: 24 }, (_, h) => ({
    value: pad(h),
    // An hour is out when it's before the min hour, or IS the min hour but no minute step clears it.
    disabled: !!minHM.value && (h < minHM.value.h || (h === minHM.value.h && maxMinuteStep <= minHM.value.m)),
  })),
)

const hourIdx = ref(Math.max(0, hourItems.value.findIndex((h) => Number(h.value) === initial.h)))

const minuteItems = computed(() => {
  const selH = Number(hourItems.value[hourIdx.value]?.value ?? initial.h)
  return initialMinuteSteps.map((m) => ({
    value: pad(m),
    disabled: !!minHM.value && (selH < minHM.value.h || (selH === minHM.value.h && m <= minHM.value.m)),
  }))
})

const minuteIdx = ref(Math.max(0, initialMinuteSteps.indexOf(initial.m)))

const hourWheel = ref(null)
const minuteWheel = ref(null)
const wheelOf = (which) => (which === 'h' ? hourWheel.value : minuteWheel.value)
const itemsOf = (which) => (which === 'h' ? hourItems.value : minuteItems.value)
const idxRefOf = (which) => (which === 'h' ? hourIdx : minuteIdx)

function scrollToIdx(which, idx, instant = false) {
  wheelOf(which)?.scrollTo({ top: idx * ITEM_H, behavior: instant ? 'instant' : 'smooth' })
}

// Debounced settle (no `scrollend` — unsupported on older iOS Safari): snap the selection to the
// centered item, bouncing off disabled items to the nearest enabled one.
const settleTimers = { h: null, m: null }
function onWheelScroll(which) {
  clearTimeout(settleTimers[which])
  settleTimers[which] = setTimeout(() => settle(which), 120)
}
function settle(which) {
  const el = wheelOf(which)
  if (!el) return
  const items = itemsOf(which)
  let idx = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)))
  if (items[idx]?.disabled) {
    const enabled = items.map((it, i) => ({ ...it, i })).filter((it) => !it.disabled)
    if (!enabled.length) return
    idx = enabled.reduce((best, it) => (Math.abs(it.i - idx) < Math.abs(best.i - idx) ? it : best)).i
    scrollToIdx(which, idx)
  }
  idxRefOf(which).value = idx
  // Hour landed on the min hour → the minute may have become disabled; re-settle it.
  if (which === 'h') settle('m')
}

const selectedTime = computed(() => {
  const h = hourItems.value[hourIdx.value]?.value ?? pad(initial.h)
  const m = minuteItems.value[minuteIdx.value]?.value ?? pad(initial.m)
  return `${h}:${m}`
})

// Live duration hint (end-time picker): "45 דקות" / "שעה" / "שעתיים ו-30 דק'" …
const durationLabel = computed(() => {
  if (!props.durationFrom) return ''
  const from = parseHM(props.durationFrom, null)
  const to = parseHM(selectedTime.value, null)
  if (!from || !to) return ''
  const mins = to.h * 60 + to.m - (from.h * 60 + from.m)
  if (mins <= 0) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const hPart = h === 1 ? 'שעה' : h === 2 ? 'שעתיים' : h > 2 ? `${h} שעות` : ''
  if (!h) return `משך: ${m} דקות`
  if (!m) return `משך: ${hPart}`
  return `משך: ${hPart} ו-${m} דק'`
})

function confirm() {
  emit('update:modelValue', selectedTime.value)
  emit('close')
}

function onKeydown(e) { if (e.key === 'Escape') emit('close') }
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  nextTick(() => {
    scrollToIdx('h', hourIdx.value, true)
    scrollToIdx('m', minuteIdx.value, true)
  })
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(settleTimers.h)
  clearTimeout(settleTimers.m)
})
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.TimePickerModal {
  $item: 40px; // must match ITEM_H in the script

  &-overlay {
    position: fixed;
    inset: 0;
    z-index: 1400;
    background: var(--modal-backdrop-bg, rgba(0, 0, 0, 0.5));
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-lg);

    @include mobile { padding: 0; align-items: flex-end; }
  }

  &-panel {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 300px;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    @include mobile {
      max-width: none;
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      padding-bottom: env(safe-area-inset-bottom, 0px);
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

  &-wheels {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-lg);
  }

  // Center highlight band behind the wheels (label row is 24px + its 4px gap).
  &-band {
    position: absolute;
    left: var(--spacing-lg);
    right: var(--spacing-lg);
    bottom: calc(var(--spacing-md) + #{$item} * 2);
    height: $item;
    background: var(--brand-dark-green-tint-light);
    border-block: 1.5px solid var(--brand-dark-green-tint);
    border-radius: var(--radius-sm);
    pointer-events: none;
  }

  &-wheelWrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  &-wheelLabel {
    height: 24px;
    display: flex;
    align-items: center;
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-muted);
  }

  &-wheel {
    height: $item * 5;
    width: 4.5rem;
    overflow-y: auto;
    scroll-snap-type: y mandatory;
    padding-block: $item * 2;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }

  &-item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: $item;
    scroll-snap-align: center;
    border: none;
    background: transparent;
    font-family: var(--font-family-body);
    font-size: var(--font-size-lg);
    color: var(--color-text-light);
    cursor: pointer;
    padding: 0;
    transition: color 0.12s, transform 0.12s;

    &--active {
      color: var(--brand-dark-green);
      font-weight: 700;
      transform: scale(1.12);
    }

    &--disabled { color: var(--color-text-muted); opacity: 0.35; }
  }

  &-colon {
    align-self: flex-end;
    height: $item * 5;
    display: flex;
    align-items: center;
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--color-text-muted);
  }

  &-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    padding: 0 var(--spacing-lg) var(--spacing-md);

    @include mobile { padding-bottom: var(--spacing-lg); }
  }

  &-duration {
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
    white-space: nowrap;
  }

  &-confirm {
    margin-inline-start: auto;
    border: none;
    border-radius: var(--radius-full);
    background: var(--brand-dark-green);
    color: #fff;
    font-family: var(--font-family-body);
    font-size: var(--font-size-sm);
    font-weight: 700;
    padding: var(--spacing-xs) var(--spacing-xl);
    cursor: pointer;
    transition: opacity 0.15s;

    &:hover { opacity: 0.92; }

    @include mobile { flex: 1; padding: var(--spacing-sm); font-size: var(--font-size-base); }
  }
}

// Fade backdrop; scale the card on desktop, slide the sheet up on mobile.
.TimePickerModal-enter-active,
.TimePickerModal-leave-active {
  transition: opacity 0.18s ease;
  .TimePickerModal-panel { transition: transform 0.18s ease, opacity 0.18s ease; }
}
.TimePickerModal-enter-from,
.TimePickerModal-leave-to {
  opacity: 0;
  .TimePickerModal-panel { transform: scale(0.96); opacity: 0; }
}
@include mobile {
  .TimePickerModal-enter-active .TimePickerModal-panel,
  .TimePickerModal-leave-active .TimePickerModal-panel { transition: transform 0.25s ease; }
  .TimePickerModal-enter-from .TimePickerModal-panel,
  .TimePickerModal-leave-to .TimePickerModal-panel { transform: translateY(100%); opacity: 1; }
}
</style>

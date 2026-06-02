<template>
  <div class="OccurrenceRow">
    <div class="OccurrenceRow-layout">

      <!-- Content: group1 + group2 wrap internally -->
      <div class="OccurrenceRow-content">
        <div class="OccurrenceRow-group1">
          <div class="OccurrenceRow-dateWrap">
            <FormField label="תאריך" required :error="errors.date">
              <input
                v-model="local.date"
                type="date"
                class="FormInput OccurrenceRow-dateInput"
                :min="minDate"
                @change="emit('update:modelValue', local)"
              />
            </FormField>
          </div>
          <div class="OccurrenceRow-allDayWrap">
            <span class="OccurrenceRow-allDayLabel">יום מלא</span>
            <label class="OccurrenceRow-toggle">
              <input v-model="allDay" type="checkbox" class="OccurrenceRow-toggleInput" @change="onAllDayChange" />
              <span class="OccurrenceRow-toggleTrack" />
            </label>
          </div>
        </div>
        <div class="OccurrenceRow-group2">
          <div class="OccurrenceRow-timeWrap OccurrenceRow-timeWrap--start">
            <FormField label="התחלה" required :error="errors.startTime">
              <div class="OccurrenceRow-timePicker" :class="{ 'OccurrenceRow-timePicker--disabled': allDay }">
                <select :value="startH" :disabled="allDay" class="OccurrenceRow-timeSelect" @change="onStartHChange">
                  <option v-for="h in hours" :key="h" :value="h">{{ h }}</option>
                </select>
                <span class="OccurrenceRow-timeSep">:</span>
                <select :value="startM" :disabled="allDay" class="OccurrenceRow-timeSelect" @change="onStartMChange">
                  <option v-for="m in minutes" :key="m" :value="m">{{ m }}</option>
                </select>
              </div>
            </FormField>
          </div>
          <div class="OccurrenceRow-timeWrap">
            <span class="OccurrenceRow-endLabel">סיום</span>
            <div class="OccurrenceRow-endUnit">
              <label class="OccurrenceRow-toggle" :class="{ 'OccurrenceRow-toggle--disabled': allDay }">
                <input v-model="hasEndTime" type="checkbox" class="OccurrenceRow-toggleInput" :disabled="allDay" @change="onHasEndTimeChange" />
                <span class="OccurrenceRow-toggleTrack" />
              </label>
              <div class="OccurrenceRow-timePicker" :class="{ 'OccurrenceRow-timePicker--disabled': !hasEndTime || allDay }">
                <select :value="endH" :disabled="!hasEndTime || allDay" class="OccurrenceRow-timeSelect" @change="onEndHChange">
                  <option v-for="h in endHoursFiltered" :key="h" :value="h">{{ h }}</option>
                </select>
                <span class="OccurrenceRow-timeSep">:</span>
                <select :value="endM" :disabled="!hasEndTime || allDay" class="OccurrenceRow-timeSelect" @change="onEndMChange">
                  <option v-for="m in endMinutesFiltered" :key="m" :value="m">{{ m }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Delete button (or invisible placeholder on first row to keep consistent break point) -->
      <button
        v-if="!isFirst"
        type="button"
        class="OccurrenceRow-remove"
        aria-label="הסר מועד"
        @click="handleRemove"
      >
        <UiIcon name="delete" size="sm" />
      </button>
      <div v-else class="OccurrenceRow-removePlaceholder" aria-hidden="true" />

    </div>

    <!-- Inline errors below the row -->
    <div v-if="errors.date || errors.startTime" class="OccurrenceRow-errors">
      <span v-if="errors.date" class="OccurrenceRow-errorText">{{ errors.date }}</span>
      <span v-if="errors.startTime" class="OccurrenceRow-errorText">{{ errors.startTime }}</span>
    </div>

    <!-- Confirm delete modal -->
    <Teleport to="body">
      <Transition name="OccurrenceRow-modal">
        <div v-if="showConfirm" class="OccurrenceRow-backdrop" @click.self="showConfirm = false">
          <div class="OccurrenceRow-dialog" role="dialog" aria-modal="true">
            <p class="OccurrenceRow-dialogText">למחוק את המועד הזה?</p>
            <div class="OccurrenceRow-dialogActions">
              <button type="button" class="OccurrenceRow-dialogCancel" @click="showConfirm = false">ביטול</button>
              <button type="button" class="OccurrenceRow-dialogConfirm" @click="confirmRemove">מחק</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
defineOptions({ name: 'OccurrenceRow' })

const props = defineProps({
  modelValue: { type: Object, required: true },
  isFirst: { type: Boolean, default: false },
  errors: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:modelValue', 'remove'])

const local = reactive({ ...props.modelValue })
watch(() => props.modelValue, (val) => Object.assign(local, val))

const minDate = computed(() => new Date().toISOString().slice(0, 10))
const allDay = ref(!local.hasTime)
const hasEndTime = ref(!!local.endTime)

const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

function parseTime(t) {
  if (!t) return { h: '08', m: '00' }
  const [h = '08', m = '00'] = String(t).split(':')
  return { h: h.padStart(2, '0'), m: m.padStart(2, '0') }
}

const startH = computed(() => parseTime(local.startTime).h)
const startM = computed(() => parseTime(local.startTime).m)
const endH = computed(() => parseTime(local.endTime).h)
const endM = computed(() => parseTime(local.endTime).m)

// End time options filtered to be after start time
const endHoursFiltered = computed(() => {
  const sh = parseInt(startH.value, 10)
  return hours.filter(h => parseInt(h, 10) >= sh)
})

const endMinutesFiltered = computed(() => {
  const sh = parseInt(startH.value, 10)
  const sm = parseInt(startM.value, 10)
  const eh = parseInt(endH.value, 10)
  if (eh === sh) return minutes.filter(m => parseInt(m, 10) > sm)
  return minutes
})

function toMins(h, m) { return parseInt(h, 10) * 60 + parseInt(m, 10) }

function autoAdjustEnd(newStartH, newStartM) {
  if (!hasEndTime.value || !local.endTime) return
  const startMins = toMins(newStartH, newStartM)
  const endMins = toMins(endH.value, endM.value)
  if (endMins <= startMins) {
    const adjusted = startMins + 60
    local.endTime = adjusted > 23 * 60 + 59
      ? '23:59'
      : `${String(Math.floor(adjusted / 60)).padStart(2, '0')}:${String(adjusted % 60).padStart(2, '0')}`
  }
}

function setStart(h, m) {
  local.startTime = `${h}:${m}`
  autoAdjustEnd(h, m)
  emit('update:modelValue', local)
}

function setEnd(h, m) { local.endTime = `${h}:${m}`; emit('update:modelValue', local) }

function onStartHChange(e) { setStart(e.target.value, startM.value) }
function onStartMChange(e) { setStart(startH.value, e.target.value) }

function onEndHChange(e) {
  const newH = e.target.value
  const sh = parseInt(startH.value, 10)
  const sm = parseInt(startM.value, 10)
  const nh = parseInt(newH, 10)
  const em = parseInt(endM.value, 10)
  // If same hour as start, ensure minute is after start minute
  const safeM = (nh === sh && em <= sm)
    ? (minutes.find(m => parseInt(m, 10) > sm) || '59')
    : endM.value
  setEnd(newH, safeM)
}

function onEndMChange(e) { setEnd(endH.value, e.target.value) }

function onAllDayChange() {
  local.hasTime = !allDay.value
  emit('update:modelValue', local)
}

function onHasEndTimeChange() {
  emit('update:modelValue', local)
}

const showConfirm = ref(false)
const isFilled = computed(() => !!(local.date || local.startTime || local.endTime))

function handleRemove() {
  if (isFilled.value) {
    showConfirm.value = true
  } else {
    emit('remove')
  }
}

function confirmRemove() {
  showConfirm.value = false
  emit('remove')
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.OccurrenceRow {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--light-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--brand-dark-green-tint);

  // Hide error text inside the row to prevent layout breakage — shown below instead
  &-layout .FormField-error { display: none; }

  &-errors {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
    padding-top: var(--spacing-xs);
  }

  &-errorText {
    font-size: var(--font-size-xs);
    color: var(--color-error);
  }

  &-layout {
    display: flex;
    align-items: flex-end;
    gap: var(--spacing-sm);
    min-width: 0;
  }

  &-content {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--spacing-sm);
  }

  &-group1 {
    display: flex;
    align-items: flex-end;
    gap: var(--spacing-sm);
    flex: 0 1 auto;
    min-width: 0;
  }

  &-group2 {
    display: flex;
    align-items: flex-end;
    gap: var(--spacing-sm);
    flex: 0 1 auto;
    min-width: 0;
  }

  &-dateWrap {
    flex: 0 0 9rem;
  }

  &-timeWrap {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: 3px;

    &--start {
      margin-left: var(--spacing-sm);
    }

    @include mobile { flex: 0 0 auto; }
  }

  &-dateInput {
    font-size: var(--font-size-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
  }

  &-timePicker {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    direction: ltr;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    padding: var(--spacing-xs) var(--spacing-sm);
    transition: border-color 0.15s;

    &:focus-within {
      border-color: var(--brand-dark-green);
    }

    &--disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  &-timeSelect {
    border: none;
    outline: none;
    background: transparent;
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    color: var(--color-text);
    cursor: pointer;
    padding: 0;
    width: 1.6rem;
    text-align: center;
    appearance: none;
    -webkit-appearance: none;

    &:disabled {
      cursor: not-allowed;
    }
  }

  &-timeSep {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-muted);
    line-height: 1;
  }

  &-allDayWrap {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-left: var(--spacing-md);
  }

  &-allDayLabel {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text);
  }

  &-endLabel {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text);
  }

  &-endUnit {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: calc(var(--control-height) - 2px);
  }

  &-toggle {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    height: calc(var(--control-height) - 2px);

    &--disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  &-toggleInput {
    display: none;

    &:checked + .OccurrenceRow-toggleTrack {
      background: var(--brand-dark-green);

      &::after {
        transform: translateX(-1.25rem);
      }
    }
  }

  &-toggleTrack {
    position: relative;
    width: 2.5rem;
    height: 1.375rem;
    background: var(--color-border);
    border-radius: var(--radius-full);
    transition: background 0.2s;
    flex-shrink: 0;

    &::after {
      content: '';
      position: absolute;
      top: 2px;
      right: 2px;
      width: 1rem;
      height: 1rem;
      background: #fff;
      border-radius: 50%;
      box-shadow: var(--shadow-sm);
      transition: transform 0.2s;
    }
  }

  &-removePlaceholder {
    flex: 0 0 29px;
    width: 29px;
    height: 29px;
    margin-bottom: 1.2px;
    margin-right: var(--spacing-sm);
    visibility: hidden;
  }

  &-remove {
    flex: 0 0 29px;
    align-self: flex-end;
    width: 29px;
    height: 29px;
    margin-bottom: 1.2px;
    margin-right: var(--spacing-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--color-error);
    color: #fff;
    cursor: pointer;
    transition: opacity 0.15s;
    padding: 0;

    &:hover {
      opacity: 0.85;
    }
  }

  &-backdrop {
    position: fixed;
    inset: 0;
    background: var(--modal-backdrop-bg);
    z-index: 1200;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &-dialog {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    padding: var(--spacing-xl);
    min-width: 18rem;
    max-width: 90vw;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    box-shadow: var(--shadow-lg);
  }

  &-dialogText {
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-text);
    text-align: center;
  }

  &-dialogActions {
    display: flex;
    gap: var(--spacing-sm);
    justify-content: center;
  }

  &-dialogCancel {
    flex: 1;
    padding: var(--spacing-sm);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: transparent;
    font-family: var(--font-family-body);
    font-size: var(--font-size-base);
    cursor: pointer;
    color: var(--color-text);

    &:hover { background: var(--color-surface); }
  }

  &-dialogConfirm {
    flex: 1;
    padding: var(--spacing-sm);
    border: none;
    border-radius: var(--radius-md);
    background: var(--color-error);
    font-family: var(--font-family-body);
    font-size: var(--font-size-base);
    font-weight: 600;
    color: #fff;
    cursor: pointer;

    &:hover { opacity: 0.9; }
  }
}

.OccurrenceRow-modal-enter-active,
.OccurrenceRow-modal-leave-active { transition: opacity 0.15s ease; }
.OccurrenceRow-modal-enter-from,
.OccurrenceRow-modal-leave-to { opacity: 0; }
</style>

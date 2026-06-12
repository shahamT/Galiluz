<template>
  <div class="OccurrenceRow" :class="{ 'OccurrenceRow--frozen': frozen }">
    <div class="OccurrenceRow-layout">

      <!-- Content: group1 + group2 wrap internally -->
      <div class="OccurrenceRow-content">
        <div class="OccurrenceRow-group1">
          <div class="OccurrenceRow-dateWrap">
            <FormField label="תאריך" required :error="errors.date">
              <VueDatePicker
                v-model="local.date"
                model-type="yyyy-MM-dd"
                :enable-time-picker="false"
                :rtl="true"
                :auto-apply="true"
                :min-date="minDate"
                :disabled="frozen"
                teleport="body"
                class="OccurrenceRow-datePicker"
                @update:model-value="emit('update:modelValue', local)"
              />
            </FormField>
          </div>
          <div class="OccurrenceRow-allDayWrap">
            <span class="OccurrenceRow-allDayLabel">יום מלא</span>
            <label class="OccurrenceRow-toggle" :class="{ 'OccurrenceRow-toggle--disabled': frozen }">
              <input v-model="allDay" type="checkbox" class="OccurrenceRow-toggleInput" :disabled="frozen" @change="onAllDayChange" />
              <span class="OccurrenceRow-toggleTrack" />
            </label>
          </div>
        </div>
        <div v-if="!allDay" class="OccurrenceRow-group2">
          <div class="OccurrenceRow-timeWrap OccurrenceRow-timeWrap--start">
            <FormField label="התחלה" required :error="errors.startTime">
              <VueDatePicker
                v-model="startTimeModel"
                time-picker
                :rtl="true"
                :auto-apply="true"
                :disabled="frozen"
                teleport="body"
                class="OccurrenceRow-timePicker"
              />
            </FormField>
          </div>
          <div class="OccurrenceRow-timeWrap">
            <span class="OccurrenceRow-endLabel">סיום</span>
            <div class="OccurrenceRow-endUnit">
              <label class="OccurrenceRow-toggle" :class="{ 'OccurrenceRow-toggle--disabled': frozen }">
                <input v-model="hasEndTime" type="checkbox" class="OccurrenceRow-toggleInput" :disabled="frozen" @change="onHasEndTimeChange" />
                <span class="OccurrenceRow-toggleTrack" />
              </label>
              <VueDatePicker
                v-if="hasEndTime"
                v-model="endTimeModel"
                time-picker
                :rtl="true"
                :auto-apply="true"
                :disabled="frozen"
                :min-time="endTimeMin"
                teleport="body"
                class="OccurrenceRow-timePicker"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="OccurrenceRow-actions" :class="{ 'OccurrenceRow-actions--first': isFirst }">
        <button
          type="button"
          class="OccurrenceRow-duplicate"
          aria-label="שכפל מועד"
          @click="emit('duplicate')"
        >
          <UiIcon name="content_copy" size="sm" />
        </button>

        <button
          type="button"
          class="OccurrenceRow-remove"
          aria-label="הסר מועד"
          @click="handleRemove"
        >
          <UiIcon name="delete" size="sm" />
        </button>
      </div>

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
import VueDatePicker from '@vuepic/vue-datepicker'

defineOptions({ name: 'OccurrenceRow' })

const props = defineProps({
  modelValue: { type: Object, required: true },
  isFirst: { type: Boolean, default: false },
  frozen: { type: Boolean, default: false },
  errors: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:modelValue', 'remove', 'duplicate'])

const local = reactive({ ...props.modelValue })
watch(() => props.modelValue, (val) => {
  Object.assign(local, { ...val })
}, { deep: true })

const minDate = computed(() => props.frozen ? undefined : new Date().toISOString().slice(0, 10))
const allDay = ref(!local.hasTime)
const hasEndTime = ref(!!local.endTime)

function hhmm(h, m) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const startTimeModel = computed({
  get: () => {
    if (!local.startTime) return null
    const [h, m] = local.startTime.split(':').map(Number)
    return { hours: h, minutes: m }
  },
  set: (val) => {
    if (!val) return
    local.startTime = hhmm(val.hours, val.minutes)
    if (hasEndTime.value && local.endTime && local.endTime <= local.startTime) {
      const adj = val.hours * 60 + val.minutes + 60
      local.endTime = adj > 23 * 60 + 59 ? '23:59' : hhmm(Math.floor(adj / 60), adj % 60)
    }
    emit('update:modelValue', local)
  },
})

const endTimeModel = computed({
  get: () => {
    if (!local.endTime) return null
    const [h, m] = local.endTime.split(':').map(Number)
    return { hours: h, minutes: m }
  },
  set: (val) => {
    if (!val) return
    local.endTime = hhmm(val.hours, val.minutes)
    emit('update:modelValue', local)
  },
})

const endTimeMin = computed(() => {
  if (!local.startTime) return undefined
  const [h, m] = local.startTime.split(':').map(Number)
  return { hours: h, minutes: m }
})

function onAllDayChange() {
  local.hasTime = !allDay.value
  emit('update:modelValue', local)
}

function onHasEndTimeChange() {
  if (hasEndTime.value) {
    if (!local.endTime) {
      const [sh, sm] = (local.startTime || '00:00').split(':').map(Number)
      const adj = sh * 60 + sm + 60
      local.endTime = adj > 23 * 60 + 59 ? '23:59' : hhmm(Math.floor(adj / 60), adj % 60)
    }
  } else {
    local.endTime = ''
  }
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

  &--frozen {
    background: var(--color-surface, #f5f5f5);
    border-color: var(--color-border);

    .OccurrenceRow-content { opacity: 0.6; pointer-events: none; }
    .OccurrenceRow-duplicate { pointer-events: all; }
  }

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

  // VueDatePicker triggers — shared base styles
  &-datePicker,
  &-timePicker {
    direction: ltr;

    .dp__input_wrap .dp__input {
      font-family: var(--font-family-body);
      font-size: var(--font-size-sm);
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: var(--spacing-xs) var(--spacing-sm);
      background: var(--color-background);
      color: var(--color-text);
      height: auto;
      min-height: 0;
      cursor: pointer;

      &:hover { border-color: var(--brand-dark-green); }
    }

    .dp__input_icon { color: var(--color-text-muted); }
  }

  &-datePicker {
    width: 9rem;
  }

  &-timePicker {
    width: 7.5rem;
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


  &-actions {
    flex-shrink: 0;
    align-self: flex-end;
    display: flex;
    gap: var(--spacing-xs);
    margin-right: var(--spacing-sm);
    margin-bottom: 1.2px;

    &--first .OccurrenceRow-duplicate { order: 1; }
  }


  &-duplicate {
    width: 29px;
    height: 29px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px dashed var(--brand-dark-green-tint);
    border-radius: var(--radius-md);
    background: var(--brand-dark-green-tint-light);
    color: var(--brand-dark-green);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    padding: 0;

    &:hover { background: var(--brand-dark-green-tint); border-style: solid; }
  }

  &-remove {
    width: 29px;
    height: 29px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px dashed var(--color-error-tint-border);
    border-radius: var(--radius-md);
    background: var(--color-error-tint-light);
    color: var(--color-error);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    padding: 0;

    &:hover { background: var(--color-error-tint); border-style: solid; }
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

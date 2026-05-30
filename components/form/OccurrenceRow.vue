<template>
  <div class="OccurrenceRow">
    <div class="OccurrenceRow-row">

      <!-- Date -->
      <div class="OccurrenceRow-dateWrap">
        <FormField label="תאריך" :required="isFirst" :error="errors.date">
          <input
            v-model="local.date"
            type="date"
            class="FormInput OccurrenceRow-dateInput"
            :min="minDate"
            @change="emit('update:modelValue', local)"
          />
        </FormField>
      </div>

      <!-- Start time -->
      <div class="OccurrenceRow-timeWrap">
        <FormField label="התחלה" :error="errors.startTime">
          <div class="OccurrenceRow-timePicker" :class="{ 'OccurrenceRow-timePicker--disabled': allDay }">
            <select
              :value="startH"
              :disabled="allDay"
              class="OccurrenceRow-timeSelect"
              @change="onStartHChange"
            >
              <option v-for="h in hours" :key="h" :value="h">{{ h }}</option>
            </select>
            <span class="OccurrenceRow-timeSep">:</span>
            <select
              :value="startM"
              :disabled="allDay"
              class="OccurrenceRow-timeSelect"
              @change="onStartMChange"
            >
              <option v-for="m in minutes" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
        </FormField>
      </div>

      <!-- End time -->
      <div class="OccurrenceRow-timeWrap">
        <FormField label="סיום">
          <div class="OccurrenceRow-timePicker" :class="{ 'OccurrenceRow-timePicker--disabled': allDay }">
            <select
              :value="endH"
              :disabled="allDay"
              class="OccurrenceRow-timeSelect"
              @change="onEndHChange"
            >
              <option v-for="h in hours" :key="h" :value="h">{{ h }}</option>
            </select>
            <span class="OccurrenceRow-timeSep">:</span>
            <select
              :value="endM"
              :disabled="allDay"
              class="OccurrenceRow-timeSelect"
              @change="onEndMChange"
            >
              <option v-for="m in minutes" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
        </FormField>
      </div>

      <!-- All day checkbox -->
      <div class="OccurrenceRow-allDayWrap">
        <label class="OccurrenceRow-allDay">
          <input v-model="allDay" type="checkbox" @change="onAllDayChange" />
          <span>יום מלא</span>
        </label>
      </div>

      <!-- Remove -->
      <button
        v-if="!isFirst"
        type="button"
        class="OccurrenceRow-remove"
        aria-label="הסר מועד"
        @click="emit('remove')"
      >
        <UiIcon name="close" size="sm" />
      </button>
    </div>
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

const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const minutes = ['00', '15', '30', '45']

function parseTime(t) {
  if (!t) return { h: '08', m: '00' }
  const [h = '08', m = '00'] = String(t).split(':')
  return { h: h.padStart(2, '0'), m: m.padStart(2, '0') }
}

const startH = computed(() => parseTime(local.startTime).h)
const startM = computed(() => parseTime(local.startTime).m)
const endH = computed(() => parseTime(local.endTime).h)
const endM = computed(() => parseTime(local.endTime).m)

function setStart(h, m) { local.startTime = `${h}:${m}`; emit('update:modelValue', local) }
function setEnd(h, m) { local.endTime = `${h}:${m}`; emit('update:modelValue', local) }

function onStartHChange(e) { setStart(e.target.value, startM.value) }
function onStartMChange(e) { setStart(startH.value, e.target.value) }
function onEndHChange(e) { setEnd(e.target.value, endM.value) }
function onEndMChange(e) { setEnd(endH.value, e.target.value) }

function onAllDayChange() {
  local.hasTime = !allDay.value
  if (allDay.value) { local.startTime = ''; local.endTime = '' }
  emit('update:modelValue', local)
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.OccurrenceRow {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--light-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--brand-dark-green-tint);

  &-row {
    display: flex;
    align-items: flex-end;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }

  &-dateWrap {
    flex: 0 0 9rem;

    @include mobile { flex: 1 1 100%; }
  }

  &-timeWrap {
    flex: 0 0 auto;

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
    width: 2.2rem;
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
    padding-bottom: 4px;

    @include mobile { flex: 0 0 auto; }
  }

  &-allDay {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;

    input[type='checkbox'] {
      width: 1rem;
      height: 1rem;
      accent-color: var(--brand-dark-green);
      cursor: pointer;
    }
  }

  &-remove {
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--color-text-light);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    margin-bottom: 2px;
    transition: background 0.15s;

    &:hover {
      background: var(--color-border);
      color: var(--color-error);
    }
  }
}
</style>

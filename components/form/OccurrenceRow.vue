<template>
  <div class="OccurrenceRow">
    <div class="OccurrenceRow-row">
      <div class="OccurrenceRow-dateWrap">
        <FormField label="תאריך" :required="isFirst" :error="errors.date">
          <input
            v-model="local.date"
            type="date"
            class="FormInput"
            :min="minDate"
            @change="emit('update:modelValue', local)"
          />
        </FormField>
      </div>

      <div class="OccurrenceRow-timeWrap">
        <FormField label="שעת התחלה" :error="errors.startTime">
          <input
            v-model="local.startTime"
            type="time"
            class="FormInput"
            :disabled="!local.hasTime"
            @change="emit('update:modelValue', local)"
          />
        </FormField>
      </div>

      <div class="OccurrenceRow-timeWrap">
        <FormField label="שעת סיום">
          <input
            v-model="local.endTime"
            type="time"
            class="FormInput"
            :disabled="!local.hasTime"
            @change="emit('update:modelValue', local)"
          />
        </FormField>
      </div>

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

    <label class="OccurrenceRow-allDay">
      <input v-model="allDay" type="checkbox" @change="onAllDayChange" />
      <span>יום מלא</span>
    </label>
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

function onAllDayChange() {
  local.hasTime = !allDay.value
  if (allDay.value) {
    local.startTime = ''
    local.endTime = ''
  }
  emit('update:modelValue', local)
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.OccurrenceRow {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--light-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--brand-dark-green-tint);

  &-row {
    display: flex;
    align-items: flex-end;
    gap: var(--spacing-sm);

    @include mobile {
      flex-wrap: wrap;
    }
  }

  &-dateWrap {
    flex: 0 0 10rem;

    @include mobile {
      flex: 1 1 100%;
    }
  }

  &-timeWrap {
    flex: 0 0 8rem;

    @include mobile {
      flex: 1 1 calc(50% - var(--spacing-sm));
    }

    .FormInput:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      background: var(--color-surface);
    }
  }

  &-remove {
    flex-shrink: 0;
    width: 2rem;
    height: 2.5rem;
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

  &-allDay {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text);
    cursor: pointer;
    user-select: none;
    width: fit-content;

    input[type='checkbox'] {
      width: 1rem;
      height: 1rem;
      accent-color: var(--brand-dark-green);
      cursor: pointer;
    }
  }
}
</style>

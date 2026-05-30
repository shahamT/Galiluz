<template>
  <div class="OccurrenceRow">
    <div class="OccurrenceRow-date">
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

    <div class="OccurrenceRow-timeToggle">
      <label class="OccurrenceRow-checkLabel">
        <input v-model="local.hasTime" type="checkbox" @change="onHasTimeChange" />
        <span>יש שעה מוגדרת?</span>
      </label>
    </div>

    <template v-if="local.hasTime">
      <div class="OccurrenceRow-times">
        <FormField label="שעת התחלה" :error="errors.startTime">
          <input
            v-model="local.startTime"
            type="time"
            class="FormInput OccurrenceRow-timeInput"
            @change="emit('update:modelValue', local)"
          />
        </FormField>
        <FormField label="שעת סיום (אופציונלי)">
          <input
            v-model="local.endTime"
            type="time"
            class="FormInput OccurrenceRow-timeInput"
            @change="emit('update:modelValue', local)"
          />
        </FormField>
      </div>
    </template>

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

function onHasTimeChange() {
  if (!local.hasTime) {
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
  position: relative;

  &-date {
    max-width: 16rem;
  }

  &-timeToggle {
    font-size: var(--font-size-sm);
  }

  &-checkLabel {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    cursor: pointer;
    user-select: none;
    font-weight: 500;
    color: var(--color-text);

    input[type='checkbox'] {
      width: 1.1rem;
      height: 1.1rem;
      accent-color: var(--brand-dark-green);
      cursor: pointer;
    }
  }

  &-times {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-md);

    @include mobile {
      grid-template-columns: 1fr;
    }
  }

  &-timeInput {
    max-width: 10rem;
  }

  &-remove {
    position: absolute;
    top: var(--spacing-sm);
    left: var(--spacing-sm);
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--color-text-light);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    transition: background 0.15s;

    &:hover {
      background: var(--color-border);
      color: var(--color-error);
    }
  }
}
</style>

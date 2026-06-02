<template>
  <div class="LinkRow" :class="{ 'LinkRow--hasErrors': errors.label || errors.url }">
    <div class="LinkRow-fields">
      <input
        :value="modelValue.label"
        type="text"
        class="FormInput"
        :class="{ 'LinkRow-inputError': errors.label }"
        placeholder="לדוגמה: לקניית כרטיסים"
        maxlength="50"
        @input="update({ label: $event.target.value })"
        @blur="emit('blur')"
      />
      <div class="LinkRow-bottom">
        <div class="LinkRow-typeToggle">
          <button
            type="button"
            class="LinkRow-typeBtn"
            :class="{ 'LinkRow-typeBtn--active': modelValue.type === 'link' }"
            @click="update({ type: 'link' })"
          >
            <UiIcon name="link" size="sm" />
          </button>
          <button
            type="button"
            class="LinkRow-typeBtn"
            :class="{ 'LinkRow-typeBtn--active': modelValue.type === 'phone' }"
            @click="update({ type: 'phone' })"
          >
            <UiIcon name="phone" size="sm" />
          </button>
        </div>
        <input
          :value="modelValue.url"
          :type="modelValue.type === 'phone' ? 'tel' : 'url'"
          class="FormInput LinkRow-url"
          :class="{ 'LinkRow-inputError': errors.url }"
          :placeholder="modelValue.type === 'phone' ? '050-0000000' : 'https://...'"
          @input="update({ url: $event.target.value })"
          @blur="emit('blur')"
        />
      </div>
      <div v-if="errors.label || errors.url" class="LinkRow-errors">
        <span v-if="errors.label" class="LinkRow-error">{{ errors.label }}</span>
        <span v-if="errors.url" class="LinkRow-error">{{ errors.url }}</span>
      </div>
    </div>
    <button type="button" class="LinkRow-remove" aria-label="הסר קישור" @click="emit('remove')">
      <UiIcon name="close" size="sm" />
    </button>
  </div>
</template>

<script setup>
defineOptions({ name: 'LinkRow' })
const props = defineProps({
  modelValue: { type: Object, default: () => ({ type: 'link', label: '', url: '' }) },
  errors: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue', 'remove', 'blur'])
function update(patch) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}
</script>

<style lang="scss">
.LinkRow {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--light-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--brand-dark-green-tint);

  &-fields {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  &-bottom {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  &-typeToggle {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  &-typeBtn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    flex-shrink: 0;
    font-size: var(--font-size-xs);
    font-family: var(--font-family-body);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    color: var(--color-text-light);
    cursor: pointer;
    transition: all 0.15s;

    &--active {
      border-color: var(--brand-dark-green);
      background: var(--brand-dark-green-tint-light);
      color: var(--brand-dark-green);
    }
  }

  &-url { flex: 1; min-width: 0; }

  &-inputError { border-color: var(--color-error) !important; }

  &-errors {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &-error {
    font-size: var(--font-size-xs);
    color: var(--color-error);
  }

  &-remove {
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--color-text-light);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);

    &:hover { background: var(--color-border); color: var(--color-error); }
  }
}
</style>

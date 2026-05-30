<template>
  <div class="LinkRow">
    <div class="LinkRow-typeToggle">
      <button
        type="button"
        class="LinkRow-typeBtn"
        :class="{ 'LinkRow-typeBtn--active': modelValue.type === 'link' }"
        @click="update({ type: 'link' })"
      >
        <UiIcon name="link" size="sm" /> קישור
      </button>
      <button
        type="button"
        class="LinkRow-typeBtn"
        :class="{ 'LinkRow-typeBtn--active': modelValue.type === 'phone' }"
        @click="update({ type: 'phone' })"
      >
        <UiIcon name="phone" size="sm" /> טלפון
      </button>
    </div>
    <div class="LinkRow-fields">
      <input
        :value="modelValue.label"
        type="text"
        class="FormInput LinkRow-label"
        placeholder="תווית (לדוגמה: כרטיסים)"
        maxlength="50"
        @input="update({ label: $event.target.value })"
      />
      <input
        :value="modelValue.url"
        :type="modelValue.type === 'phone' ? 'tel' : 'url'"
        class="FormInput LinkRow-url"
        :placeholder="modelValue.type === 'phone' ? '050-0000000' : 'https://...'"
        @input="update({ url: $event.target.value })"
      />
    </div>
    <button
      type="button"
      class="LinkRow-remove"
      aria-label="הסר קישור"
      @click="emit('remove')"
    >
      <UiIcon name="close" size="sm" />
    </button>
  </div>
</template>

<script setup>
defineOptions({ name: 'LinkRow' })
const props = defineProps({
  modelValue: { type: Object, default: () => ({ type: 'link', label: '', url: '' }) },
})
const emit = defineEmits(['update:modelValue', 'remove'])
function update(patch) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.LinkRow {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--light-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--brand-dark-green-tint);

  &-typeToggle {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-shrink: 0;
  }

  &-typeBtn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: 0.3rem var(--spacing-sm);
    font-size: var(--font-size-xs);
    font-family: var(--font-family-body);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-background);
    color: var(--color-text-light);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;

    &--active {
      border-color: var(--brand-dark-green);
      background: var(--brand-dark-green-tint-light);
      color: var(--brand-dark-green);
      font-weight: 600;
    }
  }

  &-fields {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    min-width: 0;
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
    border-radius: var(--radius-sm);
    margin-top: 2px;

    &:hover {
      background: var(--color-border);
      color: var(--color-error);
    }
  }
}
</style>

<template>
  <div class="FormField" :class="{ 'FormField--error': !!error }">
    <label v-if="label" class="FormField-label">
      {{ label }}
      <span v-if="required" class="FormField-required" aria-hidden="true">*</span>
      <span v-if="hint" class="FormField-hint">{{ hint }}</span>
    </label>
    <slot />
    <span v-if="error" class="FormField-error" role="alert">{{ error }}</span>
  </div>
</template>

<script setup>
defineOptions({ name: 'FormField' })
defineProps({
  label: { type: String, default: '' },
  error: { type: String, default: '' },
  required: { type: Boolean, default: false },
  hint: { type: String, default: '' },
})
</script>

<style lang="scss">
.FormField {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);

  &-label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text);
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--spacing-xs);
  }

  &-required {
    color: var(--color-error);
  }

  &-hint {
    font-weight: 400;
    color: var(--color-text-light);
    font-size: var(--font-size-xs);
    flex-basis: 100%;
  }

  &-error {
    font-size: var(--font-size-xs);
    color: var(--color-error);
  }

  &--error {
    .FormInput,
    .FormTextarea,
    .FormSelect {
      border-color: var(--color-error) !important;
    }
  }
}

/* Shared input styles — used across form components */
.FormInput,
.FormTextarea,
.FormSelect {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-base);
  font-family: var(--font-family-body);
  color: var(--color-text);
  background: var(--color-background);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  outline: none;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
  direction: rtl;

  &:focus {
    border-color: var(--brand-dark-green);
  }

  &::placeholder {
    color: var(--color-text-muted);
  }
}

.FormTextarea {
  resize: vertical;
  min-height: 6rem;
  line-height: 1.6;
}

.FormSelect {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23757575' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: left var(--spacing-md) center;
  padding-left: calc(var(--spacing-md) + 20px);
  cursor: pointer;
}
</style>

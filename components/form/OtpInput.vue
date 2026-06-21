<template>
  <div class="OtpInput" dir="ltr">
    <input
      v-for="(_, i) in 6"
      :key="i"
      :ref="(el) => { if (el) inputs[i] = el }"
      v-model="digits[i]"
      type="text"
      inputmode="numeric"
      maxlength="1"
      class="OtpInput-box"
      :class="{ 'OtpInput-box--error': hasError }"
      :disabled="disabled"
      @keydown="(e) => onKeydown(e, i)"
      @input="(e) => onInput(e, i)"
      @paste.prevent="onPaste"
    />
  </div>
</template>

<script setup>
// 6-digit OTP input: auto-advance, backspace-to-previous, paste-to-fill. Shared by
// the login and registration pages. v-model holds the joined code; `complete` fires
// only on a full paste (typing the 6th digit does not auto-submit — the parent's
// button does), matching the original login UX.
defineOptions({ name: 'FormOtpInput' })

const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  hasError: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'complete'])

const digits = ref(Array(6).fill(''))
const inputs = ref([])

// Reflect external resets (e.g. parent clears the code after a wrong attempt).
watch(() => props.modelValue, (val) => {
  const incoming = (val || '').split('')
  if (incoming.join('') !== digits.value.join('')) {
    digits.value = Array.from({ length: 6 }, (_, i) => incoming[i] || '')
  }
})

watch(digits, (d) => emit('update:modelValue', d.join('')), { deep: true })

function onInput(e, index) {
  const val = e.target?.value?.replace(/\D/g, '').slice(-1) || ''
  digits.value[index] = val
  if (val && index < 5) nextTick(() => inputs.value[index + 1]?.focus())
}

function onKeydown(e, index) {
  if (e.key === 'Backspace' && !digits.value[index] && index > 0) {
    nextTick(() => inputs.value[index - 1]?.focus())
  }
}

function onPaste(e) {
  const text = e.clipboardData?.getData('text') || ''
  const pasted = text.replace(/\D/g, '').slice(0, 6).split('')
  digits.value = Array.from({ length: 6 }, (_, i) => pasted[i] || '')
  nextTick(() => {
    inputs.value[Math.min(pasted.length, 5)]?.focus()
    if (pasted.length === 6) emit('complete', digits.value.join(''))
  })
}

function focus() {
  nextTick(() => inputs.value[0]?.focus())
}
defineExpose({ focus })
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.OtpInput {
  display: flex;
  gap: var(--spacing-xs);
  justify-content: center;

  &-box {
    width: 2.8rem;
    height: 3.2rem;
    font-size: var(--font-size-xl);
    font-weight: 700;
    font-family: var(--font-family-body);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    text-align: center;
    outline: none;
    transition: border-color 0.15s;
    caret-color: transparent;

    &:focus { border-color: var(--brand-dark-green); }
    &:disabled { opacity: 0.6; background: var(--color-surface); }
    &--error { border-color: var(--color-error); }

    @include mobile {
      width: 2.5rem;
      height: 3rem;
    }
  }
}
</style>

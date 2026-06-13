<template>
  <Teleport to="body">
    <Transition name="ConfirmDialog-fade">
      <div v-if="open" class="ConfirmDialog-backdrop" @click.self="emit('cancel')">
        <div class="ConfirmDialog-dialog" role="dialog" aria-modal="true">
          <h3 v-if="title" class="ConfirmDialog-title">{{ title }}</h3>
          <p class="ConfirmDialog-text">{{ message }}</p>
          <div class="ConfirmDialog-actions">
            <button type="button" class="ConfirmDialog-cancel" @click="emit('cancel')">{{ cancelLabel }}</button>
            <button type="button" class="ConfirmDialog-confirm" @click="emit('confirm')">{{ confirmLabel }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
defineOptions({ name: 'UiConfirmDialog' })

defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'אישור' },
  cancelLabel: { type: String, default: 'ביטול' },
})

const emit = defineEmits(['confirm', 'cancel'])
</script>

<style lang="scss">
.ConfirmDialog {
  &-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1300; // above EventFormModal (1200)
    background: var(--modal-backdrop-bg, rgba(0, 0, 0, 0.5));
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-lg);
  }

  &-dialog {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 22rem;
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    direction: rtl;
    text-align: center;
  }

  &-title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-text {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--color-text);
    line-height: 1.5;
  }

  &-actions {
    display: flex;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-sm);
  }

  &-cancel,
  &-confirm {
    flex: 1;
    height: var(--control-height);
    font-size: var(--font-size-base);
    font-family: var(--font-family-body);
    font-weight: 700;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: opacity 0.15s, background 0.15s;
  }

  &-cancel {
    color: var(--color-text);
    background: var(--light-bg);
    border: 1.5px solid var(--color-border);
    &:hover { background: var(--color-border); }
  }

  &-confirm {
    color: #fff;
    background: var(--brand-dark-green);
    border: none;
    &:hover { opacity: 0.9; }
  }

  &-fade-enter-active,
  &-fade-leave-active { transition: opacity 0.18s ease; }
  &-fade-enter-from,
  &-fade-leave-to { opacity: 0; }
}
</style>

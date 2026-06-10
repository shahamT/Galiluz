<template>
  <Teleport to="body">
    <div class="EventStatusModal-overlay" @click.self="emit('close')">
      <div class="EventStatusModal">
        <div class="EventStatusModal-header">
          <h2 class="EventStatusModal-title" :class="isActive ? 'EventStatusModal-title--warn' : 'EventStatusModal-title--publish'">
            {{ isActive ? 'הפיכה לטיוטה' : 'פרסום האירוע' }}
          </h2>
          <button type="button" class="EventStatusModal-close" @click="emit('close')">
            <UiIcon name="close" size="sm" />
          </button>
        </div>

        <div class="EventStatusModal-body">
          <p class="EventStatusModal-message">
            {{ isActive
              ? 'האירוע לא יופיע יותר בלוח האירועים עבור המשתמשים.'
              : 'האירוע יופיע בלוח האירועים לכלל המשתמשים.' }}
          </p>
        </div>

        <div class="EventStatusModal-footer">
          <button type="button" class="EventStatusModal-cancel" @click="emit('close')">ביטול</button>
          <button
            type="button"
            class="EventStatusModal-confirm"
            :class="isActive ? 'EventStatusModal-confirm--warn' : 'EventStatusModal-confirm--publish'"
            :disabled="loading"
            @click="handleToggle"
          >
            <UiIcon v-if="loading" name="progress_activity" size="sm" class="EventStatusModal-spinner" />
            <UiIcon v-else :name="isActive ? 'draft_orders' : 'publish'" size="sm" />
            {{ isActive ? 'הפוך לטיוטה' : 'פרסם' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineOptions({ name: 'EventStatusModal' })
const props = defineProps({
  eventId:  { type: String, required: true },
  isActive: { type: Boolean, required: true },
})
const emit = defineEmits(['close', 'updated'])

const loading = ref(false)

async function handleToggle() {
  if (loading.value) return
  loading.value = true
  try {
    await $fetch(`/api/publisher/event/${props.eventId}/status`, {
      method: 'PATCH',
      body: { isActive: !props.isActive },
    })
    emit('updated')
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss">
.EventStatusModal-overlay {
  position: fixed;
  inset: 0;
  background: var(--modal-backdrop-bg, rgba(0,0,0,0.5));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--spacing-md);
}

.EventStatusModal {
  background: var(--color-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 26rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--color-border);
  }

  &-title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 700;

    &--publish { color: var(--brand-dark-green); }
    &--warn    { color: #e65100; }
  }

  &-close {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
    padding: 0;
    display: flex;
    &:hover { color: var(--color-text); }
  }

  &-body {
    padding: var(--spacing-lg);
  }

  &-message {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
    line-height: 1.5;
  }

  &-footer {
    display: flex;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-lg);
    border-top: 1px solid var(--color-border);
    justify-content: flex-start;
  }

  &-cancel {
    height: var(--control-height);
    padding: 0 var(--spacing-lg);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: transparent;
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: var(--font-family-body);
    color: var(--color-text-light);
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;

    &:hover { border-color: var(--color-text); color: var(--color-text); }
  }

  &-confirm {
    height: var(--control-height);
    padding: 0 var(--spacing-lg);
    border: none;
    border-radius: var(--radius-md);
    color: #fff;
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: var(--font-family-body);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    transition: opacity 0.15s;

    &--publish { background: var(--brand-dark-green); }
    &--warn    { background: #e65100; }

    &:disabled { opacity: 0.4; cursor: not-allowed; }
    &:not(:disabled):hover { opacity: 0.88; }
  }

  &-spinner {
    animation: statusModalSpin 0.75s linear infinite;
  }

  @keyframes statusModalSpin {
    to { transform: rotate(360deg); }
  }
}
</style>

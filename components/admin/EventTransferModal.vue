<template>
  <Teleport to="body">
    <div class="EventTransferModal-overlay" @click.self="emit('close')">
      <div class="EventTransferModal">
        <div class="EventTransferModal-header">
          <h2 class="EventTransferModal-title">העברת אירוע</h2>
          <button type="button" class="EventTransferModal-close" @click="emit('close')">
            <UiIcon name="close" size="sm" />
          </button>
        </div>

        <div class="EventTransferModal-body">
          <div class="EventTransferModal-currentRow">
            <span class="EventTransferModal-label">מפרסם נוכחי</span>
            <span class="EventTransferModal-value">{{ currentPublisherName }}</span>
          </div>
          <div class="EventTransferModal-field">
            <span class="EventTransferModal-label">מפרסם חדש</span>
            <AdminPublisherSelect v-model="targetPublisher" :publishers="publishers" :has-error="!!error" :disabled-id="currentPublisherId" />
            <p v-if="error" class="EventTransferModal-error">{{ error }}</p>
          </div>
        </div>

        <div class="EventTransferModal-footer">
          <button type="button" class="EventTransferModal-cancel" @click="emit('close')">ביטול</button>
          <button type="button" class="EventTransferModal-confirm" :disabled="saving" @click="save">
            <UiIcon v-if="saving" name="progress_activity" size="sm" class="EventTransferModal-spinner" />
            <UiIcon v-else name="swap_horiz" size="sm" />
            {{ saving ? 'שומר...' : 'העברה' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineOptions({ name: 'AdminEventTransferModal' })

const props = defineProps({
  eventId:              { type: String, required: true },
  currentPublisherName: { type: String, default: '' },
  currentPublisherId:   { type: String, default: '' },
})
const emit = defineEmits(['close', 'transferred'])

const targetPublisher = ref(null)
const publishers = ref([])
const saving = ref(false)
const error = ref('')

onMounted(async () => {
  const data = await $fetch('/api/admin/publishers')
  publishers.value = data?.publishers || []
})

async function save() {
  if (!targetPublisher.value) { error.value = 'יש לבחור מפרסם'; return }
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/publisher/event/${props.eventId}/transfer`, {
      method: 'PATCH',
      body: { targetPublisherId: targetPublisher.value.id },
    })
    emit('transferred')
  } catch {
    error.value = 'שגיאה בשמירה, נסה שוב'
    saving.value = false
  }
}
</script>

<style lang="scss">
.EventTransferModal-overlay {
  position: fixed;
  inset: 0;
  background: var(--modal-backdrop-bg, rgba(0,0,0,0.5));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--spacing-md);
}

.EventTransferModal {
  background: var(--color-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 26rem;
  display: flex;
  flex-direction: column;

  &-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--color-border);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }

  &-title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--brand-dark-blue);
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
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  &-currentRow {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--light-bg);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
  }

  &-label {
    color: var(--color-text-muted);
    font-weight: 500;
    flex-shrink: 0;
  }

  &-value {
    font-weight: 600;
    color: var(--color-text);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &-field {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  &-error {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--color-error);
  }

  &-footer {
    display: flex;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-lg);
    border-top: 1px solid var(--color-border);
    justify-content: flex-start;
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
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
    background: var(--brand-dark-blue);
    color: #fff;
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: var(--font-family-body);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    transition: opacity 0.15s;
    &:disabled { opacity: 0.4; cursor: not-allowed; }
    &:not(:disabled):hover { opacity: 0.88; }
  }

  &-spinner {
    animation: transferModalSpin 0.75s linear infinite;
  }

  @keyframes transferModalSpin {
    to { transform: rotate(360deg); }
  }
}
</style>

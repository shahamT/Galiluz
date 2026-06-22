<template>
  <Teleport to="body">
    <div class="EventDeleteModal-overlay" @click.self="emit('close')">
      <div class="EventDeleteModal">
        <div class="EventDeleteModal-header">
          <h2 class="EventDeleteModal-title">מחיקת אירוע</h2>
          <button type="button" class="EventDeleteModal-close" @click="emit('close')">
            <UiIcon name="close" size="sm" />
          </button>
        </div>

        <div class="EventDeleteModal-body">
          <p class="EventDeleteModal-warning">פעולה זו בלתי הפיכה. לא ניתן לשחזר את האירוע לאחר מחיקתו.</p>
          <template v-if="simple">
            <p class="EventDeleteModal-instruction">האם אתם בטוחים שברצונכם למחוק את האירוע?</p>
            <p class="EventDeleteModal-eventName">{{ eventTitle }}</p>
          </template>
          <template v-else>
            <p class="EventDeleteModal-instruction">כדי לאשר, הקלד את שם האירוע:</p>
            <p class="EventDeleteModal-eventName">{{ eventTitle }}</p>
            <input
              v-model="confirmText"
              type="text"
              class="EventDeleteModal-input"
              placeholder="שם האירוע..."
              dir="rtl"
              @keydown.enter="confirmText === eventTitle && !loading && handleDelete()"
            />
          </template>
        </div>

        <div class="EventDeleteModal-footer">
          <button type="button" class="EventDeleteModal-cancel" @click="emit('close')">ביטול</button>
          <button
            type="button"
            class="EventDeleteModal-confirm"
            :disabled="loading || (!simple && confirmText !== eventTitle)"
            @click="handleDelete"
          >
            <UiIcon v-if="loading" name="progress_activity" size="sm" class="EventDeleteModal-spinner" />
            <UiIcon v-else name="delete" size="sm" />
            מחק
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineOptions({ name: 'EventDeleteModal' })
const props = defineProps({
  eventTitle: { type: String, required: true },
  eventId:    { type: String, required: true },
  // Crawler drafts (auto-generated, unreviewed) use a plain "are you sure?" confirm —
  // the type-the-title validation is overkill for a draft the publisher did not create.
  simple:     { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'deleted'])

const confirmText = ref('')
const loading = ref(false)

async function handleDelete() {
  if (loading.value) return
  if (!props.simple && confirmText.value !== props.eventTitle) return
  loading.value = true
  try {
    await $fetch(`/api/publisher/event/${props.eventId}`, { method: 'DELETE' })
    emit('deleted')
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss">
.EventDeleteModal-overlay {
  position: fixed;
  inset: 0;
  background: var(--modal-backdrop-bg, rgba(0,0,0,0.5));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--spacing-md);
}

.EventDeleteModal {
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
    color: var(--color-error);
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
    gap: var(--spacing-sm);
  }

  &-warning {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-error);
    font-weight: 600;
  }

  &-instruction {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
  }

  &-eventName {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--color-text);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--light-bg);
    border-radius: var(--radius-sm);
    word-break: break-word;
  }

  &-input {
    height: var(--control-height);
    padding: 0 var(--spacing-md);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    color: var(--color-text);
    background: var(--color-background);
    box-sizing: border-box;
    width: 100%;
    transition: border-color 0.15s;

    &::placeholder { color: var(--color-text-muted); }
    &:focus { outline: none; border-color: var(--color-error); }
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
    background: var(--color-error);
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
    animation: deleteModalSpin 0.75s linear infinite;
  }

  @keyframes deleteModalSpin {
    to { transform: rotate(360deg); }
  }
}
</style>

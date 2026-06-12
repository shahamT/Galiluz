<template>
  <Teleport to="body">
    <div class="EventCreatedModal-overlay" @click.self="emit('close')">
      <div class="EventCreatedModal">
        <button type="button" class="EventCreatedModal-close" aria-label="סגור" @click="emit('close')">
          <UiIcon name="close" size="sm" />
        </button>

        <div class="EventCreatedModal-body">
          <span class="EventCreatedModal-icon">
            <UiIcon name="check_circle" size="lg" />
          </span>
          <h2 class="EventCreatedModal-title">האירוע שיצרתם נשמר בהצלחה!</h2>
          <p class="EventCreatedModal-subtitle">האירוע עוד לא מפורסם באתר (טיוטה)</p>
          <p class="EventCreatedModal-hint">לפרסום האירוע לחצו כאן:</p>
        </div>

        <div class="EventCreatedModal-actions">
          <button type="button" class="EventCreatedModal-publish" :disabled="loading" @click="handlePublish">
            <UiIcon v-if="loading" name="progress_activity" size="sm" class="EventCreatedModal-spinner" />
            <UiIcon v-else name="publish" size="sm" />
            פרסמו את האירוע שלכם עכשיו
          </button>
          <button type="button" class="EventCreatedModal-skip" @click="emit('close')">
            המשיכו בלי לפרסם
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineOptions({ name: 'EventCreatedModal' })

const props = defineProps({
  eventId: { type: String, required: true },
})
const emit = defineEmits(['close', 'published'])

const loading = ref(false)

async function handlePublish() {
  if (loading.value) return
  loading.value = true
  try {
    await $fetch(`/api/publisher/event/${props.eventId}/status`, {
      method: 'PATCH',
      body: { isActive: true },
    })
    emit('published')
  } catch {
    // Leave the modal open; the event page's draft actions remain available
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.EventCreatedModal-overlay {
  position: fixed;
  inset: 0;
  background: var(--modal-backdrop-bg, rgba(0, 0, 0, 0.5));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-index-modal, 1000);
  padding: var(--spacing-md);
}

.EventCreatedModal {
  position: relative;
  background: var(--color-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 24rem;
  padding: var(--spacing-xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  text-align: center;

  &-close {
    position: absolute;
    top: var(--spacing-md);
    inset-inline-start: var(--spacing-md);
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
    padding: var(--spacing-xs);
    display: flex;
    border-radius: 50%;
    transition: opacity 0.2s ease;

    &:hover { opacity: 0.7; background-color: var(--day-cell-hover-bg); }
  }

  &-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
  }

  &-icon {
    color: var(--brand-dark-green);
    font-size: 3rem;
    line-height: 1;

    .UiIcon, span { font-size: 3rem; }
  }

  &-title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-subtitle {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
  }

  &-hint {
    margin: 0;
    margin-top: var(--spacing-xs);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text);
  }

  &-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md);
  }

  &-publish {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    height: var(--control-height);
    padding: 0 var(--spacing-xl);
    background: var(--brand-dark-green);
    color: #fff;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: var(--font-family-body);
    cursor: pointer;
    transition: opacity 0.15s;

    &:disabled { opacity: 0.5; cursor: not-allowed; }
    &:not(:disabled):hover { opacity: 0.9; }

    @include mobile {
      height: var(--section-header-height);
      font-size: var(--font-size-md);
    }
  }

  &-skip {
    background: none;
    border: none;
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    color: var(--color-text-light);
    padding: 0;
    text-decoration: underline;

    &:hover { color: var(--color-text); }
  }

  &-spinner {
    animation: createdModalSpin 0.75s linear infinite;
  }

  @keyframes createdModalSpin {
    to { transform: rotate(360deg); }
  }
}
</style>

<template>
  <Teleport to="body">
    <div class="EventPublishedModal-overlay" @click.self="emit('close')">
      <div class="EventPublishedModal">
        <button type="button" class="EventPublishedModal-close" aria-label="סגור" @click="emit('close')">
          <UiIcon name="close" size="sm" />
        </button>

        <div class="EventPublishedModal-body">
          <span class="EventPublishedModal-icon">
            <UiIcon name="check_circle" size="lg" />
          </span>
          <h2 class="EventPublishedModal-title">האירוע פורסם בהצלחה! 🎉</h2>

          <template v-if="url">
            <p class="EventPublishedModal-hint">הלינק לאירוע:</p>
            <div class="EventPublishedModal-linkRow">
              <a class="EventPublishedModal-linkUrl" :href="url" target="_blank" rel="noopener noreferrer">{{ url }}</a>
              <button
                type="button"
                class="EventPublishedModal-copyBtn"
                :aria-label="copied ? 'הועתק' : 'העתקת לינק'"
                @click="copy"
              >
                <UiIcon :name="copied ? 'check' : 'content_copy'" size="sm" />
              </button>
            </div>
          </template>
          <p v-else class="EventPublishedModal-subtitle">
            אין כרגע מופעים עתידיים לאירוע, ולכן עדיין אין לינק לצפייה. הוסיפו מופע עתידי כדי לשתף אותו.
          </p>
        </div>

        <button type="button" class="EventPublishedModal-done" @click="emit('close')">סגירה</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineOptions({ name: 'EventPublishedModal' })

const props = defineProps({
  // The public event link (eventScheduleUrl). Empty when the event has no future occurrence.
  url: { type: String, default: '' },
})
const emit = defineEmits(['close'])

const copied = ref(false)
async function copy() {
  if (!props.url) return
  try {
    await navigator.clipboard.writeText(props.url)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // clipboard unavailable — no-op
  }
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.EventPublishedModal-overlay {
  position: fixed;
  inset: 0;
  background: var(--modal-backdrop-bg, rgba(0, 0, 0, 0.5));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-index-modal, 1000);
  padding: var(--spacing-md);
}

.EventPublishedModal {
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
    line-height: 1.5;
  }

  &-hint {
    margin: 0;
    margin-top: var(--spacing-xs);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text);
  }

  &-linkRow {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    width: 100%;
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--light-bg);
    box-sizing: border-box;
  }

  &-linkUrl {
    flex: 1;
    min-width: 0;
    direction: ltr;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--font-size-sm);
    color: var(--brand-dark-green);
    text-decoration: none;

    &:hover { text-decoration: underline; }
  }

  &-copyBtn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--brand-dark-green);
    cursor: pointer;
    transition: background-color 0.15s;

    &:hover { background-color: var(--day-cell-hover-bg); }
  }

  &-done {
    width: 100%;
    height: var(--control-height);
    border: none;
    border-radius: var(--radius-md);
    background: var(--brand-dark-green);
    color: #fff;
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: var(--font-family-body);
    cursor: pointer;
    transition: opacity 0.15s;

    &:hover { opacity: 0.9; }

    @include mobile {
      height: var(--section-header-height);
      font-size: var(--font-size-md);
    }
  }
}
</style>

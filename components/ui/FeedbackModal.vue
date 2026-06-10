<template>
  <Teleport to="body">
    <div class="FeedbackModal-overlay" @click.self="emit('close')">
      <div class="FeedbackModal-content">

        <div class="FeedbackModal-header">
          <h2 class="FeedbackModal-title">שלחו פידבק</h2>
          <button type="button" class="FeedbackModal-close" aria-label="סגור" @click="emit('close')">
            <UiIcon name="close" size="sm" />
          </button>
        </div>

        <template v-if="!submitted">
          <div class="FeedbackModal-body">
            <p class="FeedbackModal-label">נושא</p>
            <div class="FeedbackModal-topics">
              <button
                v-for="t in TOPICS"
                :key="t.value"
                type="button"
                class="FeedbackModal-topic"
                :class="{ 'FeedbackModal-topic--active': topic === t.value }"
                @click="topic = t.value"
              >
                {{ t.label }}
              </button>
            </div>

            <p class="FeedbackModal-label">תוכן</p>
            <textarea
              v-model="content"
              class="FeedbackModal-textarea"
              :class="{ 'FeedbackModal-textarea--error': contentError }"
              placeholder="ספרו לנו..."
              rows="5"
              dir="rtl"
              maxlength="2000"
              @input="contentError = ''"
            />
            <p v-if="contentError" class="FeedbackModal-error">{{ contentError }}</p>
          </div>

          <div class="FeedbackModal-footer">
            <button
              type="button"
              class="FeedbackModal-submit"
              :disabled="!topic || isSubmitting"
              @click="handleSubmit"
            >
              <UiIcon v-if="isSubmitting" name="progress_activity" size="sm" class="FeedbackModal-spinner" />
              <template v-else>שליחה</template>
            </button>
          </div>
        </template>

        <template v-else>
          <div class="FeedbackModal-success">
            <span class="FeedbackModal-successIcon">🎉</span>
            <p class="FeedbackModal-successText">תודה! הפידבק נשלח</p>
            <button type="button" class="FeedbackModal-cancel" @click="emit('close')">סגור</button>
          </div>
        </template>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineOptions({ name: 'UiFeedbackModal' })
const emit = defineEmits(['close'])

const TOPICS = [
  { value: 'bug',     label: 'תקלה טכנית' },
  { value: 'feature', label: 'בקשת תכונה' },
  { value: 'content', label: 'תוכן שגוי באירוע' },
  { value: 'general', label: 'שאלה / הצעה' },
  { value: 'other',   label: 'אחר' },
]

const topic = ref('')
const content = ref('')
const contentError = ref('')
const isSubmitting = ref(false)
const submitted = ref(false)

async function handleSubmit() {
  if (!topic.value || isSubmitting.value) return
  if (content.value.trim().length < 10) {
    contentError.value = 'יש להזין לפחות 10 תווים'
    return
  }
  isSubmitting.value = true
  try {
    await $fetch('/api/feedback', { method: 'POST', body: { topic: topic.value, content: content.value.trim() } })
    submitted.value = true
  } catch {
    contentError.value = 'אירעה שגיאה, נסו שנית'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.FeedbackModal {
  &-overlay {
    position: fixed;
    inset: 0;
    background: var(--modal-backdrop-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-index-modal);
    padding: var(--spacing-md);

    @include mobile {
      padding: 0;
    }
  }

  &-content {
    width: 100%;
    max-width: 26rem;
    background: var(--color-background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    overflow: hidden;

    @include mobile {
      max-width: 100%;
      height: 100dvh;
      border-radius: 0;
    }
  }

  &-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  &-title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--color-text);
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
    flex: 1;
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    overflow-y: auto;
    min-height: 0;
  }

  &-label {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-light);
  }

  &-topics {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }

  &-topic {
    height: var(--control-height);
    padding: 0 var(--spacing-md);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-full);
    background: transparent;
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    color: var(--color-text-light);
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;

    &:hover {
      border-color: var(--brand-dark-green);
      color: var(--brand-dark-green);
    }

    &--active {
      border-color: var(--brand-dark-green);
      background: var(--brand-dark-green-tint-light);
      color: var(--brand-dark-green);
      font-weight: 600;
    }
  }

  &-textarea {
    width: 100%;
    box-sizing: border-box;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    color: var(--color-text);
    background: var(--color-background);
    resize: none;
    transition: border-color 0.15s;
    line-height: 1.6;

    &::placeholder { color: var(--color-text-muted); }
    &:focus { outline: none; border-color: var(--brand-dark-green); }

    &--error { border-color: var(--color-error) !important; }
  }

  &-error {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--color-error);
  }

  &-footer {
    display: flex;
    padding: var(--spacing-md) var(--spacing-lg);
    padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom, 0));
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  &-submit {
    height: var(--control-height);
    padding: 0 var(--spacing-xl);
    border: none;
    border-radius: var(--radius-md);
    background: var(--brand-dark-green);
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
    animation: feedbackSpin 0.75s linear infinite;
  }

  @keyframes feedbackSpin {
    to { transform: rotate(360deg); }
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

  &-success {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md);
    padding: var(--spacing-2xl) var(--spacing-lg);
    padding-bottom: calc(var(--spacing-2xl) + env(safe-area-inset-bottom, 0));
  }

  &-successIcon {
    font-size: 2.5rem;
    line-height: 1;
  }

  &-successText {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--brand-dark-green);
  }
}
</style>

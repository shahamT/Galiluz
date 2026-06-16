<template>
  <section class="EventFormAi" :class="{ 'EventFormAi--expanded': expanded }">
    <div class="EventFormAi-top" @click="!expanded && toggle()">
      <span class="EventFormAi-sparkle"><UiIcon name="auto_awesome" size="md" /></span>
      <h3 class="EventFormAi-title">יצירת אירוע בעזרת AI</h3>
      <p class="EventFormAi-subtitle">הדביקו את פרטי האירוע (למשל הודעת וואטסאפ) ותנו ל-AI למלא את הטופס עבורכם.</p>
      <button
        v-if="!expanded"
        type="button"
        class="EventFormAi-cta"
        @click.stop="toggle"
      >
        <UiIcon name="auto_awesome" size="sm" />
        בואו נתחיל
      </button>
      <button
        v-else
        type="button"
        class="EventFormAi-collapse"
        aria-label="סגירה"
        @click.stop="toggle"
      >
        <UiIcon name="expand_less" size="sm" />
      </button>
    </div>

    <div v-if="expanded" class="EventFormAi-body">
      <textarea
        :value="text"
        class="EventFormAi-textarea"
        rows="6"
        :disabled="loading"
        placeholder="לדוגמה: ערב מוזיקה אקוסטית בפאב השכונה, יום חמישי 5.6 בשעה 20:00. כניסה 50 ש״ח. רחוב הרצל 5, קצרין. הרשמה: https://..."
        @input="emit('update:text', $event.target.value)"
      />

      <p v-if="error" class="EventFormAi-error">{{ error }}</p>

      <div class="EventFormAi-actions">
        <p class="EventFormAi-hint">הפעולה תמלא את שדות הטופס — ניתן לערוך הכל לאחר מכן.</p>
        <button
          type="button"
          class="EventFormAi-generate"
          :disabled="loading || !text.trim()"
          @click="emit('generate')"
        >
          <span v-if="loading" class="EventFormAi-spinner" />
          <template v-else>
            <UiIcon name="auto_awesome" size="sm" />
            {{ loading ? '' : 'צרו אירוע' }}
          </template>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
defineOptions({ name: 'PublisherEventFormAiGenerate' })

const props = defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  text: { type: String, default: '' },
  expanded: { type: Boolean, default: false },
})

const emit = defineEmits(['update:text', 'update:expanded', 'generate'])

function toggle() {
  emit('update:expanded', !props.expanded)
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.EventFormAi {
  border: 1.5px solid var(--brand-dark-green-tint);
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--brand-dark-green-tint-light) 0%, rgba(255, 255, 255, 0.6) 100%);
  overflow: hidden;

  &--expanded {
    border-color: var(--brand-dark-green);
  }

  &-top {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-areas:
      "icon title    action"
      "icon subtitle action";
    align-items: center;
    column-gap: var(--spacing-md);
    row-gap: 2px;
    padding: var(--spacing-md);
    cursor: pointer;

    .EventFormAi--expanded & { cursor: default; }

    @include mobile {
      grid-template-columns: auto 1fr;
      grid-template-areas:
        "icon     title"
        "subtitle subtitle"
        "action   action";
      column-gap: var(--spacing-sm);
      row-gap: var(--spacing-sm);
    }
  }

  &-sparkle {
    grid-area: icon;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--radius-full);
    background: var(--brand-dark-green);
    color: #fff;
  }

  &-title {
    grid-area: title;
    min-width: 0;
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-subtitle {
    grid-area: subtitle;
    min-width: 0;
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
    line-height: 1.4;
  }

  &-cta {
    grid-area: action;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    height: var(--control-height);
    padding: 0 var(--spacing-md);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    font-weight: 700;
    color: #fff;
    background: var(--brand-dark-green);
    border: none;
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: opacity 0.15s;
    &:hover { opacity: 0.9; }

    @include mobile {
      width: 100%;
    }
  }

  &-collapse {
    grid-area: action;
    justify-self: end;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: var(--spacing-xs);
    &:hover { color: var(--color-text); }
  }

  &-body {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: 0 var(--spacing-md) var(--spacing-md);
  }

  &-textarea {
    width: 100%;
    resize: vertical;
    min-height: 7rem;
    padding: var(--spacing-sm) var(--spacing-md);
    font-family: var(--font-family-body);
    font-size: var(--font-size-base);
    color: var(--color-text);
    background: var(--color-background);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    line-height: 1.5;

    &:focus {
      outline: none;
      border-color: var(--brand-dark-green);
    }
    &:disabled { opacity: 0.6; }
    &::placeholder { color: var(--color-text-muted); }
  }

  &-error {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-error);
  }

  &-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);

    @include mobile {
      flex-direction: column;
      align-items: stretch;
    }
  }

  &-hint {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  &-generate {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    min-width: 10rem;
    height: var(--control-height);
    padding: 0 var(--spacing-lg);
    font-size: var(--font-size-base);
    font-family: var(--font-family-body);
    font-weight: 700;
    color: #fff;
    background: var(--brand-dark-green);
    border: none;
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: opacity 0.15s;

    &:disabled { opacity: 0.5; cursor: not-allowed; }
    &:not(:disabled):hover { opacity: 0.9; }
  }

  &-spinner {
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: eventFormAiSpin 0.7s linear infinite;
  }

  @keyframes eventFormAiSpin {
    to { transform: rotate(360deg); }
  }
}
</style>

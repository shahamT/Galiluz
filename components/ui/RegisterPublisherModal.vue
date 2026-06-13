<template>
  <Teleport to="body">
    <Transition name="RegisterPublisherModal-fade">
      <div v-if="open" class="RegisterPublisherModal-backdrop" @click.self="emit('close')">
        <div class="RegisterPublisherModal-dialog" role="dialog" aria-modal="true">
          <button type="button" class="RegisterPublisherModal-close" aria-label="סגירה" @click="emit('close')">
            <UiIcon name="close" size="md" />
          </button>

          <div class="RegisterPublisherModal-emoji">🚀</div>
          <h2 class="RegisterPublisherModal-title">הרשמה כמפרסמים בגלילו"ז</h2>
          <p class="RegisterPublisherModal-text">
            ההרשמה לגלילו"ז מתבצעת באמצעות הבוט שלנו ולוקחת פחות מדקה,
          </p>

          <a
            :href="href"
            target="_blank"
            rel="noopener noreferrer"
            class="RegisterPublisherModal-cta"
            @click="emit('register')"
          >
            בואו נתחיל
          </a>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
defineOptions({ name: 'UiRegisterPublisherModal' })

defineProps({
  open: { type: Boolean, default: false },
  href: { type: String, required: true },
})

const emit = defineEmits(['close', 'register'])
</script>

<style lang="scss">
.RegisterPublisherModal {
  &-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1300;
    background: var(--modal-backdrop-bg, rgba(0, 0, 0, 0.5));
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-lg);
  }

  &-dialog {
    position: relative;
    background: var(--color-background);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 23rem;
    padding: var(--spacing-2xl) var(--spacing-xl);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    direction: rtl;
    text-align: center;
    animation: registerModalPop 0.2s ease;
  }

  &-close {
    position: absolute;
    top: var(--spacing-sm);
    left: var(--spacing-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
    padding: var(--spacing-2xs, 0.25rem);
    border-radius: var(--radius-full);
    transition: color 0.15s, background 0.15s;

    &:hover { color: var(--color-text); background: var(--light-bg); }
  }

  &-emoji {
    font-size: 3.25rem;
    line-height: 1;
    margin-bottom: var(--spacing-2xs, 0.25rem);
  }

  &-title {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-text {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--color-text-light);
    line-height: 1.6;
  }

  &-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: var(--spacing-md);
    padding: var(--spacing-sm-lg) var(--spacing-2xl);
    font-size: var(--font-size-lg);
    font-family: var(--font-family-body);
    font-weight: 700;
    color: #fff;
    background: var(--brand-dark-green);
    border: none;
    border-radius: var(--radius-full);
    cursor: pointer;
    text-decoration: none;
    transition: opacity 0.15s;

    // Keep white text on hover (it's a button, not a text link) — overrides the
    // global a:hover link color; matches the send-OTP button's dim-only hover.
    &:hover { color: #fff; opacity: 0.9; }
  }

  &-fade-enter-active,
  &-fade-leave-active { transition: opacity 0.2s ease; }
  &-fade-enter-from,
  &-fade-leave-to { opacity: 0; }

  @keyframes registerModalPop {
    from { transform: scale(0.96); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
}
</style>

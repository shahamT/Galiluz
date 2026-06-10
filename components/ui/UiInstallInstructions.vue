<template>
  <Teleport to="body">
    <div class="UiInstallInstructions-overlay" @click.self="$emit('close')">
      <div class="UiInstallInstructions-content">
        <div class="UiInstallInstructions-header">
          <span class="UiInstallInstructions-title">הוספה למסך הבית</span>
          <button
            type="button"
            class="UiInstallInstructions-close"
            aria-label="סגור"
            @click="$emit('close')"
          >
            <UiIcon name="close" size="sm" />
          </button>
        </div>
        <ol class="UiInstallInstructions-steps">
          <li class="UiInstallInstructions-step">
            לחצ/י על כפתור השיתוף
            <span class="UiInstallInstructions-shareIcon" aria-hidden="true" />
            בתחתית המסך
          </li>
          <li class="UiInstallInstructions-step">בחר/י <strong>"הוסף למסך הבית"</strong></li>
          <li class="UiInstallInstructions-step">לחצ/י <strong>"הוסף"</strong></li>
        </ol>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineOptions({ name: 'UiInstallInstructions' })
defineEmits(['close'])
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.UiInstallInstructions {
  &-overlay {
    position: fixed;
    inset: 0;
    background: var(--modal-backdrop-bg);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: var(--z-index-modal);
    padding: var(--spacing-md);

    @include mobile {
      padding: 0;
    }
  }

  &-content {
    width: 100%;
    max-width: 22rem;
    background: var(--color-background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    padding: var(--spacing-lg);

    @include mobile {
      max-width: 100%;
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    }
  }

  &-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-md);
  }

  &-title {
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-close {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--brand-dark-green);
    border-radius: var(--radius-sm);

    &:hover {
      background-color: var(--brand-dark-green-tint);
    }
  }

  &-steps {
    margin: 0;
    padding-inline-start: var(--spacing-xl);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  &-step {
    font-size: var(--font-size-sm);
    color: var(--brand-dark-green);
    line-height: 1.5;
  }

  &-shareIcon {
    display: inline-block;
    width: 14px;
    height: 14px;
    vertical-align: middle;
    background-color: currentColor;
    color: var(--brand-dark-green);
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2l-4 4h3v9h2V6h3l-4-4zm-7 13v5h14v-5h-2v3H7v-3H5z'/%3E%3C/svg%3E") no-repeat center;
    mask-size: contain;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2l-4 4h3v9h2V6h3l-4-4zm-7 13v5h14v-5h-2v3H7v-3H5z'/%3E%3C/svg%3E") no-repeat center;
    -webkit-mask-size: contain;
  }
}
</style>

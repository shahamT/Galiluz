<template>
  <div
    v-if="!isInstalled && !dismissed && (canInstall || isIOS)"
    class="UiInstallBanner"
    role="banner"
    @click="handleInstallClick"
  >
    <UiIcon name="add_to_home_screen" size="sm" class="UiInstallBanner-icon" />
    <span class="UiInstallBanner-text">הוסיפו את גלילו"ז למסך הבית שלכם</span>
    <button
      type="button"
      class="UiInstallBanner-close"
      aria-label="סגור"
      @click.stop="dismiss"
    >
      <UiIcon name="close" size="sm" />
    </button>
  </div>
</template>

<script setup>
defineOptions({ name: 'UiInstallBanner' })

const { canInstall, isIOS, isInstalled, showInstructions, triggerInstall } = useInstallPrompt()

const dismissed = ref(false)

function dismiss() {
  dismissed.value = true
}

async function handleInstallClick() {
  await navigateTo('/events')
  if (isIOS.value) {
    showInstructions.value = true
  } else {
    triggerInstall()
  }
}
</script>

<style lang="scss">
.UiInstallBanner {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-3xl);
  background-color: var(--brand-dark-green);
  color: #fff;
  cursor: pointer;
  width: 100%;
  user-select: none;

  &:hover {
    filter: brightness(1.1);
  }

  &-icon {
    flex-shrink: 0;
    color: #fff;
  }

  &-text {
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-align: center;
  }

  &-close {
    position: absolute;
    inset-inline-end: var(--spacing-md);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: transparent;
    color: #fff;
    opacity: 0.7;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: opacity 0.15s;

    &:hover {
      opacity: 1;
    }
  }
}
</style>

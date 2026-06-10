<template>
  <div
    v-if="installEnabled && !isInstalled && !dismissed && (canInstall || isIOS)"
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

const { canInstall, isIOS, isInstalled, installEnabled, showInstructions, triggerInstall } = useInstallPrompt()

const BANNER_DISMISSED_KEY = 'galiluz-install-banner-dismissed'
const dismissed = ref(false)

onMounted(() => {
  try { dismissed.value = sessionStorage.getItem(BANNER_DISMISSED_KEY) === '1' } catch {}
})

function dismiss() {
  dismissed.value = true
  try { sessionStorage.setItem(BANNER_DISMISSED_KEY, '1') } catch {}
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  background-color: var(--brand-dark-blue);
  color: #fff;
  cursor: pointer;
  width: 100%;
  user-select: none;

  &:hover {
    background-color: #3483a3;
  }

  &-icon {
    flex-shrink: 0;
    color: #fff;
  }

  &-text {
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  &-close {
    margin-inline-start: auto;
    flex-shrink: 0;
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

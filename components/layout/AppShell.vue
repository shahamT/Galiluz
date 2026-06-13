<template>
  <div class="AppShell">
    <UiInstallBanner />
    <LayoutAppHeader @menu-click="isMainMenuOpen = true" />
    <UiMainMenu v-model="isMainMenuOpen" />
    <UiInstallInstructions v-if="showInstructions" @close="showInstructions = false" />
    <slot name="nav" />
    <div class="AppShell-scroller">
      <div class="AppShell-content">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'AppShell' })

const isMainMenuOpen = ref(false)
const { showInstructions } = useInstallPrompt()
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.AppShell {
  height: 100vh; // fallback for browsers without dvh support
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-background);
  background-image: linear-gradient(
    135deg,
    var(--gradient-bg-start),
    var(--gradient-bg-end)
  );

  &-scroller {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    direction: ltr; // scrollbar at screen edge
    scrollbar-gutter: stable;
  }

  &-content {
    direction: rtl;
    max-width: var(--content-max-width);
    width: 100%;
    margin: 0 auto;
    padding: var(--spacing-xl);
    padding-inline: var(--spacing-3xl);
    min-height: 100%;
    display: flex;
    flex-direction: column;

    @include mobile {
      padding-inline: 0;
      padding-block: var(--spacing-md);
      padding-bottom: max(var(--spacing-2xl), env(safe-area-inset-bottom));
    }
  }
}
</style>

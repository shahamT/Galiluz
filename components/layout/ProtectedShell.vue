<template>
  <ClientOnly>
    <LayoutAppShell v-if="authStore.authReady">
      <slot />
    </LayoutAppShell>
    <div v-else class="AuthLoader">
      <img src="/logos/galiluz-logo-rtl.svg" alt='גלילו"ז' class="AuthLoader-logo" />
      <div class="AuthLoader-spinner" aria-label="טוען..." />
    </div>
    <template #fallback>
      <div class="AuthLoader">
        <img src="/logos/galiluz-logo-rtl.svg" alt='גלילו"ז' class="AuthLoader-logo" />
        <div class="AuthLoader-spinner" aria-label="טוען..." />
      </div>
    </template>
  </ClientOnly>
</template>

<script setup>
defineOptions({ name: 'LayoutProtectedShell' })
const authStore = useAuthStore()
</script>

<style lang="scss">
.AuthLoader {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xl);
  background: var(--color-background);

  &-logo {
    height: 2.5rem;
    width: auto;
    opacity: 0.7;
  }

  &-spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid var(--brand-dark-green-tint);
    border-top-color: var(--brand-dark-green);
    border-radius: 50%;
    animation: authSpin 0.75s linear infinite;
  }

  @keyframes authSpin {
    to { transform: rotate(360deg); }
  }
}
</style>

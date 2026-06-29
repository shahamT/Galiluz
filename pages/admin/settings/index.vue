<template>
  <!-- Mobile: drill-in list of settings (CSS-hidden on desktop, which redirects to the first subpage). -->
  <nav class="AdminSettingsList">
    <NuxtLink
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      class="AdminSettingsList-row"
    >
      <UiIcon :name="item.icon" size="sm" class="AdminSettingsList-icon" />
      <span class="AdminSettingsList-label">{{ item.label }}</span>
      <UiIcon name="chevron_left" size="sm" class="AdminSettingsList-chevron" />
    </NuxtLink>
  </nav>
</template>

<script setup>
defineOptions({ name: 'AdminSettingsIndex' })

const navItems = useAdminSettingsNav()

// On desktop there's a persistent sidebar, so /admin/settings jumps straight to
// the first subpage the user can access (the list above is CSS-hidden on desktop).
// Client-only to avoid an SSR/viewport mismatch.
onMounted(() => {
  if (window.matchMedia('(min-width: 769px)').matches) {
    navigateTo(navItems.value[0]?.to || '/admin/dashboard', { replace: true })
  }
})
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.AdminSettingsList {
  display: none;

  @include mobile {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  &-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--color-background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    text-decoration: none;
    color: var(--color-text);

    &:active { background: var(--light-bg); }
  }

  &-icon { color: var(--brand-dark-green); flex-shrink: 0; }
  &-label { flex: 1; font-weight: 600; font-size: var(--font-size-base); line-height: 1.3; }
  &-chevron { color: var(--color-text-light); flex-shrink: 0; }
}
</style>

<template>
  <div class="AdminSettings">
    <!-- Desktop: persistent sidebar of settings. Hidden on mobile (drill-in instead). -->
    <aside class="AdminSettings-sidebar">
      <NuxtLink
        v-for="item in ADMIN_SETTINGS_NAV"
        :key="item.to"
        :to="item.to"
        class="AdminSettings-link"
        :class="{ 'AdminSettings-link--active': route.path === item.to }"
      >
        <UiIcon :name="item.icon" size="sm" class="AdminSettings-linkIcon" />
        <span class="AdminSettings-linkLabel">{{ item.label }}</span>
      </NuxtLink>
    </aside>

    <div class="AdminSettings-content">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ADMIN_SETTINGS_NAV } from '~/consts/adminSettingsNav.js'

defineOptions({ name: 'AdminSettingsLayout' })
const route = useRoute()
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.AdminSettings {
  display: flex;
  gap: var(--spacing-xl);
  align-items: flex-start;

  @include mobile {
    gap: 0;
  }

  &-sidebar {
    flex-shrink: 0;
    width: 16rem;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    background: var(--color-background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    padding: var(--spacing-sm);
    position: sticky;
    top: var(--spacing-md);

    // Drill-in on mobile: the list lives in the index page, not the sidebar.
    @include mobile { display: none; }
  }

  &-link {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    text-decoration: none;
    color: var(--color-text);
    font-size: var(--font-size-sm);
    font-weight: 600;
    transition: background 0.15s, color 0.15s;

    &:hover { background: var(--light-bg); }

    &--active {
      background: var(--brand-dark-green);
      color: #fff;
      &:hover { background: var(--brand-dark-green); }
    }
  }

  &-linkIcon { flex-shrink: 0; color: inherit; }
  &-linkLabel { min-width: 0; line-height: 1.3; }

  &-content {
    flex: 1;
    min-width: 0;
  }
}
</style>

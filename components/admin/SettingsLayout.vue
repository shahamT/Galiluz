<template>
  <div class="AdminSettings">
    <!-- Desktop: persistent sidebar of settings. Hidden on mobile (drill-in instead). -->
    <aside class="AdminSettings-sidebar" :style="{ height: sidebarHeight }">
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

// Pin the sidebar to the visible viewport: header + tabs sit above .AppShell-scroller (the
// only scroll region), so the sidebar fills the scroller's height minus the content padding,
// staying fully on screen regardless of how tall the page content is. Overflow scrolls inside.
const sidebarHeight = ref('')
function measureSidebar() {
  if (typeof window === 'undefined') return
  const scroller = document.querySelector('.AppShell-scroller')
  if (!scroller || !scroller.clientHeight) return
  sidebarHeight.value = `calc(${Math.round(scroller.clientHeight)}px - var(--spacing-xl) * 2)`
}
onMounted(() => {
  nextTick(measureSidebar)
  window.addEventListener('resize', measureSidebar)
})
onUnmounted(() => window.removeEventListener('resize', measureSidebar))
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
    // Stay pinned in view; height is set inline to the scroller's visible area (see script).
    position: sticky;
    top: var(--spacing-xl);
    overflow-y: auto;

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

    // Override the global `a:hover` (which turns links blue).
    &:hover {
      background: var(--light-bg);
      color: var(--color-text);
    }

    &--active {
      background: var(--brand-dark-green);
      color: #fff;
      &:hover {
        background: var(--brand-dark-green);
        color: #fff;
      }
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

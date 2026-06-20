<template>
  <nav class="AdminNavTabs">
    <NuxtLink to="/admin/dashboard" class="AdminNavTabs-tab" :class="{ 'AdminNavTabs-tab--active': isDashboard }">
      <UiIcon name="dashboard" size="sm" class="AdminNavTabs-tabIcon" />
      <span class="AdminNavTabs-label">דשבורד</span>
      <span class="AdminNavTabs-labelMobile">דשבורד</span>
    </NuxtLink>
    <NuxtLink to="/admin/events" class="AdminNavTabs-tab" :class="{ 'AdminNavTabs-tab--active': isEvents }">
      <UiIcon name="event_note" size="sm" class="AdminNavTabs-tabIcon" />
      <span class="AdminNavTabs-label">אירועים</span>
      <span class="AdminNavTabs-labelMobile">אירועים</span>
    </NuxtLink>
    <NuxtLink to="/admin/accounts" class="AdminNavTabs-tab" :class="{ 'AdminNavTabs-tab--active': isAccounts }">
      <UiIcon name="manage_accounts" size="sm" class="AdminNavTabs-tabIcon" />
      <span class="AdminNavTabs-label">חשבונות ומפרסמים</span>
      <span class="AdminNavTabs-labelMobile">חשבונות</span>
    </NuxtLink>
    <NuxtLink to="/admin/settings" class="AdminNavTabs-tab" :class="{ 'AdminNavTabs-tab--active': isSettings }">
      <UiIcon name="settings" size="sm" class="AdminNavTabs-tabIcon" />
      <span class="AdminNavTabs-label">הגדרות</span>
      <span class="AdminNavTabs-labelMobile">הגדרות</span>
    </NuxtLink>
  </nav>
</template>

<script setup>
defineOptions({ name: 'AdminNavTabs' })

const route = useRoute()
const isDashboard = computed(() => route.path === '/admin/dashboard' || route.path === '/admin')
const isEvents = computed(() => route.path.startsWith('/admin/events'))
const isAccounts = computed(() => route.path.startsWith('/admin/accounts'))
const isSettings = computed(() => route.path.startsWith('/admin/settings'))
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.AdminNavTabs {
  display: flex;
  background-color: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 2px 0 var(--brand-dark-green-tint);
  padding-top: var(--spacing-md);
  padding-inline: calc(var(--spacing-3xl) + max(0px, (100vw - var(--content-max-width)) / 2));

  @include mobile {
    padding-inline: var(--spacing-md);
  }

  &-tab {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 0 var(--spacing-xl);
    min-height: 3.25rem;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text-light);
    text-decoration: none;
    border-bottom: 3px solid transparent;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    transition: color 0.15s, border-color 0.15s, background-color 0.15s;
    white-space: nowrap;

    &:hover {
      color: var(--brand-dark-green);
    }

    &--active {
      background-color: var(--brand-dark-green);
      color: #fff;
      border-bottom-color: var(--brand-dark-green);

      &:hover {
        color: #fff;
      }
    }

    @include mobile {
      flex: 1;
      justify-content: center;
      min-height: 3rem;
      padding: 0 var(--spacing-sm);
      font-size: var(--font-size-base);
    }
  }

  &-tabIcon {
    color: inherit;
    flex-shrink: 0;
  }

  // Desktop shows the full label; mobile shows the short one (keeps 3 tabs fitting).
  &-labelMobile { display: none; }

  @include mobile {
    &-label { display: none; }
    &-labelMobile { display: inline; }
  }
}
</style>

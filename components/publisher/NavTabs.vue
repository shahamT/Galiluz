<template>
  <nav class="PublisherNavTabs">
    <NuxtLink to="/publisher/dashboard" class="PublisherNavTabs-tab" :class="{ 'PublisherNavTabs-tab--active': isDashboard }">
      דשבורד
    </NuxtLink>
    <NuxtLink to="/publisher/events" class="PublisherNavTabs-tab" :class="{ 'PublisherNavTabs-tab--active': isEvents }">
      האירועים שלי
    </NuxtLink>
  </nav>
</template>

<script setup>
defineOptions({ name: 'PublisherNavTabs' })

const route = useRoute()
const isDashboard = computed(() => route.path === '/publisher/dashboard' || route.path === '/publisher')
const isEvents = computed(() => route.path.startsWith('/publisher/events'))
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.PublisherNavTabs {
  display: flex;
  border-bottom: 2px solid var(--brand-dark-green-tint);
  margin-bottom: var(--spacing-xl);

  &-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 var(--spacing-lg);
    min-height: 2.75rem;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-text-light);
    text-decoration: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;

    &:hover {
      color: var(--brand-dark-green);
    }

    &--active {
      color: var(--brand-dark-green);
      border-bottom-color: var(--brand-dark-green);
    }

    @include mobile {
      flex: 1;
      min-height: 3rem;
      padding: 0 var(--spacing-md);
      font-size: var(--font-size-sm);
    }
  }
}
</style>

<template>
  <nav class="PublisherNavTabs">
    <NuxtLink to="/publisher/dashboard" class="PublisherNavTabs-tab" :class="{ 'PublisherNavTabs-tab--active': isDashboard }">
      <UiIcon name="dashboard" size="sm" class="PublisherNavTabs-tabIcon" />
      דשבורד
    </NuxtLink>
    <NuxtLink to="/publisher/events" class="PublisherNavTabs-tab" :class="{ 'PublisherNavTabs-tab--active': isEvents }">
      <UiIcon name="event_note" size="sm" class="PublisherNavTabs-tabIcon" />
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
      padding: 0 var(--spacing-md);
      font-size: var(--font-size-base);
    }
  }

  &-tabIcon {
    color: inherit;
    flex-shrink: 0;
  }
}
</style>

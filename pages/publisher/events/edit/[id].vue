<template>
  <LayoutProtectedShell>
    <PublisherNavTabs />
    <div class="PublisherEditEvent-body">
      <NuxtLink :to="`/publisher/events/${route.params.id}`" class="PublisherEditEvent-back">
        <UiIcon name="arrow_forward" size="sm" />
        חזרה לפרטי האירוע
      </NuxtLink>
      <div class="PublisherEditEvent-placeholder">
        <UiIcon name="edit" size="lg" class="PublisherEditEvent-placeholderIcon" />
        <p>עריכת אירוע — בקרוב</p>
      </div>
    </div>
  </LayoutProtectedShell>
</template>

<script setup>
defineOptions({ name: 'PublisherEditEvent' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'עריכת אירוע | גלילו"ז' })
const route = useRoute()
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.PublisherEditEvent {
  &-body {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);
    padding-top: var(--spacing-md);

    @include mobile { padding-inline: var(--spacing-md); }
  }

  &-back {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--brand-dark-green);
    text-decoration: none;
    &:hover { opacity: 0.8; }
  }

  &-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md);
    padding: var(--spacing-3xl) 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-lg);
    p { margin: 0; }
  }

  &-placeholderIcon { font-size: 3rem; opacity: 0.4; }
}
</style>

<template>
  <div class="DashboardEventsOverview">
    <div class="DashboardEventsOverview-stats">
      <div class="DashboardEventsOverview-stat">
        <span class="DashboardEventsOverview-value DashboardEventsOverview-value--green">{{ counts.future }}</span>
        <span class="DashboardEventsOverview-label">אירועים פעילים</span>
      </div>
      <div class="DashboardEventsOverview-divider" />
      <div class="DashboardEventsOverview-stat">
        <span class="DashboardEventsOverview-value DashboardEventsOverview-value--light-green">{{ counts.past }}</span>
        <span class="DashboardEventsOverview-label">אירועים שהסתיימו</span>
      </div>
    </div>
    <NuxtLink to="/publisher/add-event" class="DashboardEventsOverview-cta">
      <UiIcon name="add" size="sm" />
      פרסם אירוע חדש
    </NuxtLink>
  </div>
</template>

<script setup>
defineOptions({ name: 'DashboardEventsOverview' })
defineProps({ counts: { type: Object, default: () => ({ total: 0, future: 0, past: 0 }) } })
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.DashboardEventsOverview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  background: var(--light-bg);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg) var(--spacing-xl);
  margin-bottom: var(--spacing-xl);

  @include mobile {
    flex-direction: column;
    align-items: stretch;
    padding: var(--spacing-md);
  }

  &-stats {
    display: flex;
    align-items: center;
    gap: var(--spacing-xl);

    @include mobile { justify-content: space-around; }
  }

  &-divider {
    width: 1px;
    height: 2rem;
    background: var(--color-border);
    flex-shrink: 0;
  }

  &-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-2xs);
  }

  &-value {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--color-text);
    line-height: 1;

    &--green { color: var(--brand-dark-green); }
    &--light-green { color: var(--brand-light-green); }
  }

  &-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-light);
    white-space: nowrap;
  }

  &-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    height: var(--control-height);
    padding: 0 var(--spacing-xl);
    background: var(--brand-dark-green);
    color: var(--chip-text-white);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    transition: opacity 0.2s ease;
    flex-shrink: 0;

    &:hover, &:visited, &:active { color: var(--chip-text-white); }
    &:hover { opacity: 0.9; }

    @include mobile {
      height: var(--section-header-height);
      font-size: var(--font-size-md);
      padding: 0 var(--spacing-md);
      align-self: stretch;
    }
  }
}
</style>

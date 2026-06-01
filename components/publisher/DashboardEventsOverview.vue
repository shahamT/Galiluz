<template>
  <div class="DashboardEventsOverview">
    <div class="DashboardEventsOverview-stats">
      <div class="DashboardEventsOverview-stat">
        <span class="DashboardEventsOverview-value">{{ counts.total }}</span>
        <span class="DashboardEventsOverview-label">סה"כ אירועים</span>
      </div>
      <div class="DashboardEventsOverview-divider" />
      <div class="DashboardEventsOverview-stat">
        <span class="DashboardEventsOverview-value DashboardEventsOverview-value--green">{{ counts.future }}</span>
        <span class="DashboardEventsOverview-label">אירועים עתידיים</span>
      </div>
      <div class="DashboardEventsOverview-divider" />
      <div class="DashboardEventsOverview-stat">
        <span class="DashboardEventsOverview-value DashboardEventsOverview-value--muted">{{ counts.past }}</span>
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
  background: var(--color-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
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
    &--muted { color: var(--color-text-muted); }
  }

  &-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-light);
    white-space: nowrap;
  }

  &-cta {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--brand-dark-green);
    color: #fff;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    transition: opacity 0.15s;
    flex-shrink: 0;

    &:hover { opacity: 0.9; }

    @include mobile { justify-content: center; }
  }
}
</style>

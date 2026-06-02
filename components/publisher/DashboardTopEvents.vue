<template>
  <div class="DashboardTopEvents">
    <h3 class="DashboardTopEvents-title">האירועים המובילים</h3>
    <div v-if="!events?.length" class="DashboardTopEvents-empty">אין נתוני צפיות עדיין</div>
    <ul v-else class="DashboardTopEvents-list">
      <li v-for="(ev, i) in events" :key="`${ev.eventId}-${ev.occurrenceDate || i}`" class="DashboardTopEvents-row">
        <span class="DashboardTopEvents-rank">{{ i + 1 }}</span>
        <div class="DashboardTopEvents-info">
          <span class="DashboardTopEvents-name">{{ ev.title }}</span>
          <span class="DashboardTopEvents-date">
            <template v-if="ev.startDate && ev.endDate">{{ ev.startDate }} – {{ ev.endDate }}</template>
            <template v-else-if="ev.occurrenceDate">{{ ev.occurrenceDate }}</template>
          </span>
        </div>
        <div class="DashboardTopEvents-metrics">
          <span class="DashboardTopEvents-views">{{ ev.views }}<span class="DashboardTopEvents-viewsLabel"> צפיות</span></span>
          <span class="DashboardTopEvents-unique">{{ ev.uniqueViews }} ייחודיות</span>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
defineOptions({ name: 'DashboardTopEvents' })
defineProps({ events: { type: Array, default: () => [] } })
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.DashboardTopEvents {
  background: var(--color-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: var(--spacing-lg);

  &-title {
    margin: 0 0 var(--spacing-md);
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--brand-dark-green);
  }

  &-empty {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    text-align: center;
    padding: var(--spacing-lg) 0;
  }

  &-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-xs);
    border-radius: var(--radius-sm);
    transition: background 0.1s;

    &:hover { background: var(--light-bg); }
  }

  &-rank {
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--color-text-muted);
    width: 1.2rem;
    text-align: center;
    flex-shrink: 0;
  }

  &-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  &-name {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &-date {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    direction: ltr;
    text-align: right;
  }

  &-metrics {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
    flex-shrink: 0;
  }

  &-views {
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-viewsLabel {
    font-weight: 400;
    color: var(--color-text-light);
  }

  &-unique {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }
}
</style>

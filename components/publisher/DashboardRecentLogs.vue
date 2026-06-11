<template>
  <div class="DashboardRecentLogs">
    <h3 class="DashboardRecentLogs-title">פעילות אחרונה</h3>
    <ul v-if="loading" class="DashboardRecentLogs-list">
      <li v-for="i in 6" :key="i" class="DashboardRecentLogs-row">
        <div class="DashboardRecentLogs-sk DashboardRecentLogs-sk--icon" />
        <div class="DashboardRecentLogs-info">
          <div class="DashboardRecentLogs-sk DashboardRecentLogs-sk--text" />
          <div class="DashboardRecentLogs-sk DashboardRecentLogs-sk--time" />
        </div>
      </li>
    </ul>
    <PublisherDashboardEmptyState
      v-else-if="!logs?.length"
      compact
      :show-button="false"
      text="אין פעילות אחרונה"
    />
    <ul v-else class="DashboardRecentLogs-list">
      <li v-for="log in logs" :key="log.createdAt" class="DashboardRecentLogs-row">
        <span class="DashboardRecentLogs-icon" :class="`DashboardRecentLogs-icon--${log.action}`">
          <UiIcon :name="iconFor(log.action)" size="sm" />
        </span>
        <div class="DashboardRecentLogs-info">
          <span class="DashboardRecentLogs-text">
            {{ prefixFor(log.action) }} <strong>{{ log.title || 'אירוע' }}</strong>
          </span>
          <span class="DashboardRecentLogs-time">{{ relativeTime(log.createdAt) }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
defineOptions({ name: 'DashboardRecentLogs' })
defineProps({
  logs: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

function iconFor(action) {
  if (action === 'event_activated') return 'check_circle'
  if (action === 'event_edited') return 'edit'
  if (action === 'event_deleted') return 'delete'
  return 'history'
}

function prefixFor(action) {
  if (action === 'event_activated') return 'פרסמת את'
  if (action === 'event_edited') return 'עדכנת את'
  if (action === 'event_deleted') return 'מחקת אירוע:'
  return ''
}

function relativeTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `לפני ${mins || 1} דקות`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `לפני ${hrs} שעות`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'אתמול'
  if (days < 30) return `לפני ${days} ימים`
  return new Date(iso).toLocaleDateString('he-IL')
}
</script>

<style lang="scss">
.DashboardRecentLogs {
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

  &-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  &-row {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }

  &-icon {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 1rem;

    &--event_activated { background: rgba(11,151,74,0.12); color: var(--brand-dark-green); }
    &--event_edited    { background: rgba(25,118,210,0.12); color: var(--color-primary); }
    &--event_deleted   { background: rgba(211,47,47,0.12);  color: var(--color-error); }
  }

  &-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  &-text {
    font-size: var(--font-size-sm);
    color: var(--color-text);
    line-height: 1.4;
  }

  &-time {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  &-sk {
    border-radius: var(--radius-sm);
    background: linear-gradient(90deg, var(--color-border) 25%, rgba(255,255,255,0.6) 50%, var(--color-border) 75%);
    background-size: 200% 100%;
    animation: logsShimmer 1.4s infinite;

    &--icon { width: 2rem; height: 2rem; border-radius: 50%; flex-shrink: 0; }
    &--text { width: 75%; height: 0.85rem; }
    &--time { width: 40%; height: 0.7rem; margin-top: 4px; }
  }

  @keyframes logsShimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
}
</style>

<template>
  <div class="DashboardRecentLogs">
    <h3 class="DashboardRecentLogs-title">פעילות אחרונה</h3>
    <div v-if="!logs?.length" class="DashboardRecentLogs-empty">אין פעילות אחרונה</div>
    <ul v-else class="DashboardRecentLogs-list">
      <li v-for="log in logs" :key="log.createdAt" class="DashboardRecentLogs-row">
        <span class="DashboardRecentLogs-icon" :class="`DashboardRecentLogs-icon--${log.action}`">
          <span class="material-symbols-rounded">{{ iconFor(log.action) }}</span>
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
defineProps({ logs: { type: Array, default: () => [] } })

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
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--color-text);
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

    .material-symbols-rounded { font-size: 1.1rem; }
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
}
</style>

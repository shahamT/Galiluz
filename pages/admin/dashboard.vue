<template>
  <LayoutProtectedShell>
    <AdminNavTabs />

    <div class="AdminDashboard-body">
    <div class="AdminDashboard-header">
      <h1 class="AdminDashboard-title">דשבורד ניהול</h1>
      <p class="AdminDashboard-greeting">ברוך/ה הבאה {{ authStore.user?.fullName }}, כאן מבט-על על כלל האירועים, החשבונות והמפרסמים בפלטפורמה.</p>
    </div>

    <PublisherDashboardEventsOverview :counts="data?.eventCounts || { total: 0, future: 0, past: 0, drafts: 0 }" @add-event="showEventForm = true" />

    <div class="AdminDashboard-divider" />
    <PublisherDashboardFilterBar v-model="filter" />

    <!-- KPI row -->
    <div class="AdminDashboard-kpis">
      <PublisherDashboardKpiCard
        label="אירועים פעילים"
        :value="data?.activeEventsCount || 0"
        icon="event"
        color="#0b974a"
        :loading="isFirstLoad"
      />
      <PublisherDashboardKpiCard
        label="צפיות"
        :value="data?.totals?.views || 0"
        icon="visibility"
        color="#85c84b"
        :loading="isFirstLoad"
      />
      <PublisherDashboardKpiCard
        label="מבקרים ייחודיים"
        :value="data?.totals?.uniqueViews || 0"
        icon="person"
        color="#3c92b5"
        :loading="isFirstLoad"
      />
      <PublisherDashboardKpiCard
        label="אינטרקציות"
        :value="totalInteractions"
        icon="touch_app"
        color="#80dcda"
        :loading="isFirstLoad"
      />
    </div>

    <!-- Bottom row -->
    <div class="AdminDashboard-bottom">
      <PublisherDashboardTopEvents :events="data?.topEvents || []" :loading="isFirstLoad" />
      <PublisherDashboardRecentLogs :logs="data?.recentLogs || []" :loading="isFirstLoad" />
    </div>
    </div>

    <PublisherEventFormModal v-if="showEventForm" @close="showEventForm = false" @submitted="onEventSaved" />
  </LayoutProtectedShell>
</template>

<script setup>
defineOptions({ name: 'AdminDashboard' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'דשבורד ניהול | גלילו"ז' })

const authStore = useAuthStore()
const { capture } = usePosthog()
const filter = ref('active')
const showEventForm = ref(false)
function onEventSaved({ id }) {
  showEventForm.value = false
  if (id) {
    capture('publisher_event_created', { eventId: id, source: 'admin_dashboard' })
    navigateTo(`/publisher/events/${id}?success=created`)
  }
}

const { data, pending, refresh } = await useAuthFetch('/api/admin/dashboard', {
  query: computed(() => ({ filter: filter.value })),
  watch: [filter],
})

// Returning to the dashboard tab reuses cached data — refetch so stats reflect
// actions performed elsewhere. Existing numbers stay visible during the silent refresh.
onMounted(() => { refresh() })
const isFirstLoad = computed(() => pending.value && !data.value)

const totalInteractions = computed(() => {
  const t = data.value?.totals
  if (!t) return 0
  return (t.shares || 0) + (t.navClicks || 0) + (t.calendarAdds || 0) + (t.linkClicks || 0) + (t.contactClicks || 0)
})
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.AdminDashboard {
  &-body {
    flex: 1;
    display: flex;
    flex-direction: column;

    @include mobile {
      padding-inline: var(--spacing-md);
    }
  }

  &-header {
    margin-bottom: var(--spacing-xl);
  }

  &-title {
    margin: 0 0 var(--spacing-xs);
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-greeting {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--color-text-light);
    line-height: 1.5;
  }

  &-divider {
    height: 1px;
    background: var(--brand-light-green);
    margin: var(--spacing-lg) 0;
  }

  &-kpis {
    display: flex;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-xl);

    @include mobile {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
  }

  &-bottom {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-md);

    @include mobile {
      grid-template-columns: 1fr;
    }
  }
}
</style>

<template>
  <LayoutProtectedShell>
    <PublisherNavTabs />

    <PublisherDashboardEventsOverview :counts="data?.eventCounts || { total: 0, future: 0, past: 0 }" />

    <PublisherDashboardFilterBar v-model="filter" />

    <!-- KPI row -->
    <div class="PublisherDashboard-kpis">
      <PublisherDashboardKpiCard
        label="צפיות"
        :value="data?.totals?.views || 0"
        icon="visibility"
        color="var(--brand-dark-green)"
      />
      <PublisherDashboardKpiCard
        label="מבקרים ייחודיים"
        :value="data?.totals?.uniqueViews || 0"
        icon="person"
        color="#0ea5e9"
      />
      <PublisherDashboardKpiCard
        label="אירועים פעילים"
        :value="data?.activeEventsCount || 0"
        icon="event"
        color="#6366f1"
      />
      <PublisherDashboardKpiCard
        label="אינטרקציות"
        :value="totalInteractions"
        icon="touch_app"
        color="#f59e0b"
      />
    </div>

    <!-- Bottom row -->
    <div class="PublisherDashboard-bottom">
      <PublisherDashboardTopEvents :events="data?.topEvents || []" />
      <PublisherDashboardRecentLogs :logs="data?.recentLogs || []" />
    </div>
  </LayoutProtectedShell>
</template>

<script setup>
defineOptions({ name: 'PublisherDashboard' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'דשבורד | גלילו"ז' })

const filter = ref('all')

const { data, refresh } = await useFetch('/api/publisher/dashboard', {
  query: computed(() => ({ filter: filter.value })),
  watch: [filter],
})

const totalInteractions = computed(() => {
  const t = data.value?.totals
  if (!t) return 0
  return (t.shares || 0) + (t.navClicks || 0) + (t.calendarAdds || 0) + (t.linkClicks || 0) + (t.contactClicks || 0)
})
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.PublisherDashboard {
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

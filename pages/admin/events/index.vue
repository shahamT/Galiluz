<template>
  <LayoutProtectedShell>
    <AdminNavTabs />

    <div class="AdminEvents-body">
      <div class="AdminEvents-header">
        <h1 class="AdminEvents-title">כל האירועים</h1>
        <p class="AdminEvents-description">צפייה וניהול של כל האירועים בפלטפורמה, מכל החשבונות והמפרסמים.</p>
      </div>

      <div class="AdminEvents-container">
        <PublisherEventsSearchBar v-model="filter" v-model:search="search" @add-event="showEventForm = true" />

        <!-- Skeleton -->
        <template v-if="pending">
          <div v-for="i in 5" :key="i" class="AdminEvents-skeleton" />
        </template>

        <!-- List -->
        <div v-else-if="filteredEvents.length" class="AdminEvents-list">
          <PublisherEventListItem
            v-for="event in filteredEvents"
            :key="event.id"
            :event="event"
          />
        </div>

        <!-- No events at all -->
        <PublisherDashboardEmptyState
          v-else-if="!events?.length"
          text="אין אירועים במערכת"
          :show-button="false"
        />

        <!-- Search with no matches -->
        <PublisherDashboardEmptyState
          v-else-if="isSearching"
          text="לא נמצאו אירועים מתאימים לחיפוש"
          button-label="איפוס"
          button-icon="close"
          @action="search = ''"
        />

        <!-- Has events but none for the current filter -->
        <PublisherDashboardEmptyState
          v-else-if="filter === 'future'"
          text="אין אירועים עתידיים"
          :show-button="false"
        />
        <PublisherDashboardEmptyState
          v-else
          text="אין אירועים שהסתיימו"
          :show-button="false"
        />
      </div>
    </div>

    <PublisherEventFormModal v-if="showEventForm" @close="showEventForm = false" @submitted="onEventCreated" />
  </LayoutProtectedShell>
</template>

<script setup>
defineOptions({ name: 'AdminEvents' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'אירועים | ניהול | גלילו"ז' })

const { capture } = usePosthog()
const filter = ref('all')
const search = ref('')
const debouncedSearch = useDebounce(search, 200)
const showEventForm = ref(false)

function onEventCreated({ id }) {
  showEventForm.value = false
  if (id) {
    capture('publisher_event_created', { eventId: id, source: 'admin_events_list' })
    navigateTo(`/publisher/events/${id}?success=created`)
  }
}

const { data: events, pending } = await useAuthFetch('/api/admin/events')

const today = new Date().toISOString().slice(0, 10)

const isSearching = computed(() => !!debouncedSearch.value.trim())

const filteredEvents = computed(() => {
  let list = events.value || []

  if (filter.value === 'future') {
    list = list.filter(e => e.occurrences.some(o => o.date >= today))
  } else if (filter.value === 'past') {
    list = list.filter(e => e.occurrences.every(o => o.date < today))
  }

  if (isSearching.value) {
    const q = debouncedSearch.value.trim().toLowerCase()
    list = list.filter(e => e.title.toLowerCase().includes(q))
  }

  return list
})
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.AdminEvents {
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

  &-description {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--color-text-light);
    line-height: 1.5;
  }

  &-container {
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.6);
    border-radius: var(--radius-lg);
    padding: var(--spacing-lg);

    @include mobile {
      padding: var(--spacing-md);
    }
  }

  &-skeleton {
    height: 4.5rem;
    border-radius: var(--radius-lg);
    background: linear-gradient(90deg, var(--color-border) 25%, rgba(255,255,255,0.6) 50%, var(--color-border) 75%);
    background-size: 200% 100%;
    animation: adminEventsShimmer 1.4s infinite;
    margin-bottom: var(--spacing-sm);

    @keyframes adminEventsShimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  }

  &-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }
}
</style>

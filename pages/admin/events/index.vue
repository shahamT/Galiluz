<template>
  <LayoutProtectedShell>
    <template #nav>
      <AdminNavTabs />
    </template>

    <div class="AdminEvents-body">
      <div class="AdminEvents-header">
        <h1 class="AdminEvents-title">כל האירועים</h1>
        <p class="AdminEvents-description">צפייה וניהול של כל האירועים בפלטפורמה, מכל החשבונות והמפרסמים.</p>
      </div>

      <div class="AdminEvents-container">
        <!-- Filter bar: shared search/filter row + manager-only account/publisher filter directly beneath it -->
        <div class="AdminEvents-filters">
          <PublisherEventsSearchBar v-model="filter" v-model:search="search" @add-event="showEventForm = true" />
          <AdminPublisherFilterSelect
            v-model="publisherFilter"
            :accounts="pubOptions?.accounts || []"
            :publishers="pubOptions?.publishers || []"
          />
        </div>

        <!-- Skeleton -->
        <template v-if="pending">
          <div v-for="i in 5" :key="i" class="AdminEvents-skeleton" />
        </template>

        <!-- List + pagination -->
        <template v-else-if="filteredEvents.length">
          <div class="AdminEvents-list">
            <PublisherEventListItem
              v-for="event in pagedEvents"
              :key="event.id"
              :event="event"
              :to="`/admin/events/${event.id}`"
            />
          </div>
          <UiPagination
            v-if="filteredEvents.length > PAGE_SIZE"
            v-model="currentPage"
            :total="filteredEvents.length"
            :page-size="PAGE_SIZE"
            class="AdminEvents-pagination"
            @update:model-value="onPageChange"
          />
        </template>

        <!-- Empty states -->
        <template v-else>
          <PublisherDashboardEmptyState
            v-if="!events?.length"
            text="אין אירועים במערכת"
            :show-button="false"
          />
          <PublisherDashboardEmptyState
            v-else-if="isSearching"
            text="לא נמצאו אירועים מתאימים לחיפוש"
            button-label="איפוס"
            button-icon="close"
            @action="search = ''"
          />
          <PublisherDashboardEmptyState
            v-else-if="publisherFilter"
            text="אין אירועים למפרסם או לחשבון שנבחר"
            button-label="איפוס סינון"
            button-icon="close"
            @action="publisherFilter = null"
          />
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
        </template>
      </div>
    </div>

    <PublisherEventFormModal
      v-if="showEventForm"
      :on-behalf-publishers="pubOptions?.publishers || []"
      @close="showEventForm = false"
      @submitted="onEventCreated"
    />
  </LayoutProtectedShell>
</template>

<script setup>
defineOptions({ name: 'AdminEvents' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'אירועים | ניהול | גלילו"ז' })

const { capture } = usePosthog()
const PAGE_SIZE = 8
const filter = ref('future')
const search = ref('')
const debouncedSearch = useDebounce(search, 200)
const showEventForm = ref(false)
const publisherFilter = ref(null) // { kind: 'account'|'publisher', id, label, accountName? } | null
const currentPage = ref(1)

function onEventCreated({ id }) {
  showEventForm.value = false
  if (id) {
    capture('publisher_event_created', { eventId: id, source: 'admin_events_list' })
    navigateTo(`/admin/events/${id}?success=created`)
  }
}

const { data: events, pending } = await useAuthFetch('/api/admin/events')
const { data: pubOptions } = await useAuthFetch('/api/admin/publishers')

const today = new Date().toISOString().slice(0, 10)

const isSearching = computed(() => !!debouncedSearch.value.trim())

const filteredEvents = computed(() => {
  let list = events.value || []

  // Account / publisher filter (manager-only): an account resolves to the set of
  // its publishers' ids; a single publisher matches its id directly.
  if (publisherFilter.value) {
    if (publisherFilter.value.kind === 'publisher') {
      list = list.filter(e => e.publisherId === publisherFilter.value.id)
    } else {
      const pubIds = new Set(
        (pubOptions.value?.publishers || [])
          .filter(p => p.accountId === publisherFilter.value.id)
          .map(p => p.id),
      )
      list = list.filter(e => pubIds.has(e.publisherId))
    }
  }

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

watch([filter, debouncedSearch, publisherFilter], () => { currentPage.value = 1 })

const pagedEvents = computed(() =>
  filteredEvents.value.slice((currentPage.value - 1) * PAGE_SIZE, currentPage.value * PAGE_SIZE)
)

function onPageChange() {
  document.querySelector('.AppShell-scroller')?.scrollTo({ top: 0, behavior: 'smooth' })
}
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

  // Group the shared search/filter row with the account/publisher filter as one
  // bar: tight gap between them, normal spacing below the block before the list.
  &-filters {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);

    // The shared search bar carries its own bottom margin — collapse it so the
    // publisher filter sits snugly directly beneath the other filters.
    .EventsSearchBar { margin-bottom: 0; }
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

  &-pagination {
    margin-top: var(--spacing-md);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--color-border);
  }
}
</style>

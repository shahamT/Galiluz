<template>
  <LayoutProtectedShell>
    <template #nav>
      <PublisherNavTabs />
    </template>

    <div class="PublisherEvents-body">
      <div class="PublisherEvents-header">
        <h1 class="PublisherEvents-title">אירועים</h1>
        <p class="PublisherEvents-description">כאן תוכל/י לנהל, לערוך ולעקוב אחר כל האירועים בחשבון שלך.</p>
      </div>

      <div class="PublisherEvents-container">
        <PublisherEventsSearchBar v-model="filter" v-model:search="search" @add-event="showEventForm = true" />

        <!-- Skeleton -->
        <template v-if="pending">
          <div v-for="i in 5" :key="i" class="PublisherEvents-skeleton" />
        </template>

        <!-- List + pagination (one branch so the empty states below stay in the same chain) -->
        <template v-else-if="filteredEvents.length">
          <div class="PublisherEvents-list">
            <PublisherEventListItem
              v-for="event in pagedEvents"
              :key="event.id"
              :event="event"
            />
          </div>

          <UiPagination
            v-if="filteredEvents.length > PAGE_SIZE"
            v-model="currentPage"
            :total="filteredEvents.length"
            :page-size="PAGE_SIZE"
            class="PublisherEvents-pagination"
            @update:model-value="onPageChange"
          />
        </template>

        <!-- No events at all -->
        <PublisherDashboardEmptyState
          v-else-if="!events?.length"
          text="אין לכם עדיין אירועים"
          button-label="הוסיפו את האירוע הראשון שלכם"
          @action="showEventForm = true"
        />

        <!-- Search with no matches -->
        <PublisherDashboardEmptyState
          v-else-if="isSearching"
          text="לא נמצאו אירועים מתאימים לחיפוש שלכם"
          button-label="איפוס"
          button-icon="close"
          @action="search = ''"
        />

        <!-- Has events but none for the current filter -->
        <PublisherDashboardEmptyState
          v-else-if="filter === 'future'"
          text="אין לכם אירועים עתידיים"
          button-label="הוסיפו אירוע חדש"
          @action="showEventForm = true"
        />
        <PublisherDashboardEmptyState
          v-else
          text="אין לכם אירועים שהסתיימו"
          button-label="הוסיפו אירוע חדש"
          @action="showEventForm = true"
        />
      </div>
    </div>

    <PublisherEventFormModal
      v-if="showEventForm"
      :draft-key="route.query.draft || null"
      @close="showEventForm = false; clearDraftFromUrl()"
      @submitted="onEventCreated"
    />
  </LayoutProtectedShell>
</template>

<script setup>
defineOptions({ name: 'PublisherEvents' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'אירועים | גלילו"ז' })

const route = useRoute()
const router = useRouter()
const { capture } = usePosthog()
const PAGE_SIZE = 8
const filter = ref('future')
const search = ref('')
const debouncedSearch = useDebounce(search, 200)
const showEventForm = ref(false)
const currentPage = ref(1)

function onEventCreated({ id }) {
  showEventForm.value = false
  if (id) {
    capture('publisher_event_created', { eventId: id, source: 'events_list' })
    navigateTo(`/publisher/events/${id}?success=created`)
  }
}

onMounted(() => {
  if (route.query.modal === 'add') showEventForm.value = true
})

function clearDraftFromUrl() {
  if (route.query.modal || route.query.draft) router.replace({ query: {} })
}

const { data: events, pending } = await useAuthFetch('/api/publisher/events')

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

watch([filter, debouncedSearch], () => { currentPage.value = 1 })

const pagedEvents = computed(() =>
  filteredEvents.value.slice((currentPage.value - 1) * PAGE_SIZE, currentPage.value * PAGE_SIZE)
)

function onPageChange() {
  document.querySelector('.AppShell-scroller')?.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.PublisherEvents {
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
    animation: eventsShimmer 1.4s infinite;
    margin-bottom: var(--spacing-sm);

    @keyframes eventsShimmer {
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

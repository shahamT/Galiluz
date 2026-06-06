<template>
  <LayoutProtectedShell>
    <PublisherNavTabs />

    <div class="PublisherEvents-body">
      <div class="PublisherEvents-header">
        <h1 class="PublisherEvents-title">האירועים שלי</h1>
        <button type="button" class="PublisherEvents-cta" @click="showEventForm = true">
          <UiIcon name="add" size="sm" />
          אירוע חדש
        </button>
      </div>

      <PublisherEventsSearchBar v-model="filter" v-model:search="search" />

      <!-- Skeleton -->
      <template v-if="pending">
        <div v-for="i in 5" :key="i" class="PublisherEvents-skeleton" />
      </template>

      <!-- List -->
      <div v-else-if="filteredEvents.length" class="PublisherEvents-list">
        <PublisherEventListItem
          v-for="event in filteredEvents"
          :key="event.id"
          :event="event"
        />
      </div>

      <!-- No events at all -->
      <div v-else-if="!events?.length" class="PublisherEvents-empty">
        <UiIcon name="event" size="lg" class="PublisherEvents-emptyIcon" />
        <p>אין לך אירועים עדיין</p>
        <button type="button" class="PublisherEvents-cta" @click="showEventForm = true">
          <UiIcon name="add" size="sm" />
          אירוע חדש
        </button>
      </div>

      <!-- Has events but no future ones -->
      <div v-else-if="filter === 'future'" class="PublisherEvents-empty">
        <UiIcon name="event_upcoming" size="lg" class="PublisherEvents-emptyIcon" />
        <p>אין אירועים עתידיים</p>
        <button type="button" class="PublisherEvents-emptyCta" @click="showEventForm = true">
          <UiIcon name="add" size="sm" />
          אירוע חדש
        </button>
      </div>

      <!-- No results from filter / search -->
      <div v-else class="PublisherEvents-empty">
        <UiIcon name="search_off" size="lg" class="PublisherEvents-emptyIcon" />
        <p>לא נמצאו אירועים</p>
      </div>
    </div>

    <PublisherEventFormModal v-if="showEventForm" @close="showEventForm = false" @submitted="({ id }) => { showEventForm = false; if (id) navigateTo(`/publisher/events/${id}?success=created`) }" />
  </LayoutProtectedShell>
</template>

<script setup>
defineOptions({ name: 'PublisherEvents' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'האירועים שלי | גלילו"ז' })

const filter = ref('future')
const search = ref('')
const debouncedSearch = useDebounce(search, 200)
const showEventForm = ref(false)

const { data: events, pending } = await useAuthFetch('/api/publisher/events')

const today = new Date().toISOString().slice(0, 10)

const filteredEvents = computed(() => {
  let list = events.value || []

  if (filter.value === 'future') {
    list = list.filter(e => e.occurrences.some(o => o.date >= today))
  } else if (filter.value === 'past') {
    list = list.filter(e => e.occurrences.every(o => o.date < today))
  }

  if (debouncedSearch.value.trim()) {
    const q = debouncedSearch.value.trim().toLowerCase()
    list = list.filter(e => e.title.toLowerCase().includes(q))
  }

  return list
})
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);

    @include mobile {
      align-items: center;
    }
  }

  &-title {
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-cta {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    height: var(--control-height);
    padding: 0 var(--spacing-lg);
    background: var(--brand-dark-green);
    color: var(--chip-text-white);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: var(--font-family-body);
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;
    flex-shrink: 0;
    transition: opacity 0.2s;

    &:hover, &:visited, &:active { color: var(--chip-text-white); }
    &:hover { opacity: 0.9; }

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

  &-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md);
    padding: var(--spacing-3xl) 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-base);
    text-align: center;

    p { margin: 0; }
  }

  &-emptyIcon {
    font-size: 3rem;
    opacity: 0.4;
  }

  &-emptyCta {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    height: var(--control-height);
    padding: 0 var(--spacing-lg);
    border: 1.5px solid var(--brand-dark-green);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--brand-dark-green);
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: var(--font-family-body);
    cursor: pointer;
    transition: background 0.15s;
    &:hover { background: rgba(11,151,74,0.07); }
  }

  &-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }
}
</style>

<template>
  <LayoutProtectedShell>
    <PublisherNavTabs />

    <div class="EventPage-body">
      <!-- Success banner -->
      <Transition name="EventPage-bannerFade">
        <div v-if="successBanner" class="EventPage-successBanner">
          <UiIcon name="check_circle" size="sm" />
          {{ successBanner }}
        </div>
      </Transition>

      <!-- Page header -->
      <div class="EventPage-header">
        <NuxtLink to="/publisher/events" class="EventPage-back">
          <UiIcon name="arrow_forward" size="sm" />
          חזרה לאירועים שלי
        </NuxtLink>
        <div class="EventPage-headerRow">
          <h1 v-if="event" class="EventPage-title">{{ event.title }}</h1>
          <div v-else class="EventPage-titleSkeleton" />
        </div>
        <div v-if="event" class="EventPage-actions">
          <button type="button" class="EventPage-actionBtn EventPage-actionBtn--edit" @click="showEditForm = true">
            <UiIcon name="edit" size="sm" />
            עריכת אירוע
          </button>
          <button type="button" class="EventPage-actionBtn EventPage-actionBtn--delete" @click="showDeleteModal = true">
            <UiIcon name="delete" size="sm" />
            מחיקה
          </button>
        </div>
      </div>

      <!-- Loading skeleton -->
      <template v-if="pending">
        <div v-for="i in 4" :key="i" class="EventPage-skeleton" />
      </template>

      <template v-else-if="event">
        <PublisherEventPreview :event="event" />

        <!-- Statistics -->
        <h2 class="EventPage-sectionTitle">
          <UiIcon name="bar_chart" size="sm" />
          סטטיסטיקות
        </h2>

        <template v-if="event.multiDayEvent">
          <div class="EventPage-statCard">
            <div class="EventPage-statGrid">
              <div class="EventPage-stat EventPage-stat--views">
                <UiIcon name="visibility" size="sm" />
                <span class="EventPage-statLabel">צפיות</span>
                <span class="EventPage-statValue">{{ event.stats.totalViews }}</span>
              </div>
              <div class="EventPage-stat EventPage-stat--unique">
                <UiIcon name="person" size="sm" />
                <span class="EventPage-statLabel">מבקרים ייחודיים</span>
                <span class="EventPage-statValue">{{ event.stats.totalUniqueViews }}</span>
              </div>
              <div class="EventPage-stat EventPage-stat--blue">
                <UiIcon name="share" size="sm" />
                <span class="EventPage-statLabel">שיתופים</span>
                <span class="EventPage-statValue">{{ event.stats.shares }}</span>
              </div>
              <div class="EventPage-stat EventPage-stat--blue">
                <UiIcon name="navigation" size="sm" />
                <span class="EventPage-statLabel">ניווט</span>
                <span class="EventPage-statValue">{{ event.stats.navClicks }}</span>
              </div>
              <div class="EventPage-stat EventPage-stat--blue">
                <UiIcon name="calendar_add_on" size="sm" />
                <span class="EventPage-statLabel">הוספה ליומן</span>
                <span class="EventPage-statValue">{{ event.stats.calendarAdds }}</span>
              </div>
              <div class="EventPage-stat EventPage-stat--blue">
                <UiIcon name="contact_phone" size="sm" />
                <span class="EventPage-statLabel">יצירת קשר</span>
                <span class="EventPage-statValue">{{ event.stats.contactClicks }}</span>
              </div>
            </div>
            <div v-if="linksWithClicks.length" class="EventPage-statLinksList">
              <div v-for="link in linksWithClicks" :key="link.title" class="EventPage-linkBreakdown">
                <span class="EventPage-linkBreakdownTitle">{{ link.title }}</span>
                <span class="EventPage-linkBreakdownCount">{{ link.clicks }}</span>
              </div>
            </div>
            <p v-if="isZeroStats" class="EventPage-statsEmpty">אין נתונים עדיין</p>
          </div>
        </template>

        <template v-else>
          <div v-for="occ in event.stats.occurrenceStats" :key="occ.date" class="EventPage-statCard">
            <h4 class="EventPage-statCardDate">{{ formatOccurrenceDate(occ.date) }}</h4>
            <div class="EventPage-statGrid">
              <div class="EventPage-stat EventPage-stat--views">
                <UiIcon name="visibility" size="sm" />
                <span class="EventPage-statLabel">צפיות</span>
                <span class="EventPage-statValue">{{ occ.views }}</span>
              </div>
              <div class="EventPage-stat EventPage-stat--unique">
                <UiIcon name="person" size="sm" />
                <span class="EventPage-statLabel">מבקרים ייחודיים</span>
                <span class="EventPage-statValue">{{ occ.uniqueViews }}</span>
              </div>
              <div class="EventPage-stat EventPage-stat--blue">
                <UiIcon name="calendar_add_on" size="sm" />
                <span class="EventPage-statLabel">הוספה ליומן</span>
                <span class="EventPage-statValue">{{ occ.calendarAdds }}</span>
              </div>
              <div class="EventPage-stat EventPage-stat--blue">
                <UiIcon name="share" size="sm" />
                <span class="EventPage-statLabel">שיתופים</span>
                <span class="EventPage-statValue">{{ event.stats.shares }}</span>
              </div>
              <div class="EventPage-stat EventPage-stat--blue">
                <UiIcon name="navigation" size="sm" />
                <span class="EventPage-statLabel">ניווט</span>
                <span class="EventPage-statValue">{{ event.stats.navClicks }}</span>
              </div>
              <div class="EventPage-stat EventPage-stat--blue">
                <UiIcon name="contact_phone" size="sm" />
                <span class="EventPage-statLabel">יצירת קשר</span>
                <span class="EventPage-statValue">{{ event.stats.contactClicks }}</span>
              </div>
            </div>
            <div v-if="linksWithClicks.length" class="EventPage-statLinksList">
              <div v-for="link in linksWithClicks" :key="link.title" class="EventPage-linkBreakdown">
                <span class="EventPage-linkBreakdownTitle">{{ link.title }}</span>
                <span class="EventPage-linkBreakdownCount">{{ link.clicks }}</span>
              </div>
            </div>
            <p v-if="occ.views === 0 && occ.uniqueViews === 0 && event.stats.shares === 0 && event.stats.navClicks === 0" class="EventPage-statsEmpty">אין נתונים עדיין</p>
          </div>
        </template>
      </template>
    </div>

    <PublisherEventFormModal
      v-if="showEditForm && event"
      mode="edit"
      :initial-data="event"
      @close="showEditForm = false"
      @submitted="onEditSubmitted"
    />

    <PublisherEventDeleteModal
      v-if="showDeleteModal && event"
      :event-title="event.title"
      :event-id="event.id"
      @close="showDeleteModal = false"
      @deleted="navigateTo('/publisher/events')"
    />
  </LayoutProtectedShell>
</template>

<script setup>
defineOptions({ name: 'PublisherEventDetail' })
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const showDeleteModal = ref(false)
const showEditForm = ref(false)

const successBanner = ref('')
onMounted(() => {
  const s = route.query.success
  if (s === 'created') successBanner.value = 'האירוע נוסף בהצלחה!'
  else if (s === 'updated') successBanner.value = 'האירוע עודכן בהצלחה!'
  if (successBanner.value) {
    const t = setTimeout(() => { successBanner.value = '' }, 4000)
    onUnmounted(() => clearTimeout(t))
    router.replace({ query: {} })
  }
})

// M4: await refresh before showing success banner
async function onEditSubmitted() {
  showEditForm.value = false
  await refresh()
  router.replace({ query: { success: 'updated' } })
}

const { data: event, pending, refresh } = await useAuthFetch(`/api/publisher/event/${route.params.id}`)

useHead(computed(() => ({ title: event.value ? `${event.value.title} | גלילו"ז` : 'פרטי אירוע | גלילו"ז' })))

const isZeroStats = computed(() => {
  const s = event.value?.stats
  if (!s) return true
  return s.totalViews === 0 && s.totalUniqueViews === 0 && s.shares === 0 && s.navClicks === 0 && s.calendarAdds === 0 && s.contactClicks === 0 && s.linkClicks === 0
})

const linksWithClicks = computed(() => {
  const urls = event.value?.urls || []
  const breakdown = event.value?.stats?.linkBreakdown || []
  const breakdownMap = new Map(breakdown.map(b => [b.title.toLowerCase().trim(), b.clicks]))
  return urls.map(u => ({
    title: u.Title,
    clicks: breakdownMap.get((u.Title || '').toLowerCase().trim()) || 0,
  }))
})

function formatOccurrenceDate(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${parseInt(d)}/${m}/${y.slice(2)}`
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.EventPage {
  &-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);

    @include mobile { padding-inline: var(--spacing-md); }
  }

  &-successBanner {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(11,151,74,0.1);
    color: var(--brand-dark-green);
    border: 1px solid var(--brand-dark-green-tint);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  &-bannerFade {
    &-enter-active, &-leave-active { transition: opacity 0.4s, transform 0.4s; }
    &-enter-from { opacity: 0; transform: translateY(-8px); }
    &-leave-to   { opacity: 0; transform: translateY(-8px); }
  }

  &-header {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  &-headerRow {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  &-back {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--brand-dark-green);
    text-decoration: none;
    flex-shrink: 0;
    &:hover { opacity: 0.8; }
  }

  &-title {
    flex: 1;
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: var(--brand-dark-green);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &-titleSkeleton {
    flex: 1;
    height: 1.8rem;
    border-radius: var(--radius-sm);
    background: var(--color-border);
  }

  &-actions {
    display: flex;
    gap: var(--spacing-sm);

    .EventPage-actionBtn { flex: 1; }
  }

  &-actionBtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    height: var(--control-height);
    padding: 0 var(--spacing-lg);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: var(--font-family-body);
    cursor: pointer;
    text-decoration: none;
    background: transparent;
    transition: background 0.15s, color 0.15s;

    &--edit {
      border: 1.5px solid var(--brand-dark-green);
      color: var(--brand-dark-green);
      &:hover, &:visited, &:active { color: var(--brand-dark-green); }
      &:hover { background: rgba(11,151,74,0.07); }
    }

    &--delete {
      border: 1.5px solid var(--color-error);
      color: var(--color-error);
      &:hover { background: rgba(211,47,47,0.07); }
    }
  }

  &-sectionTitle {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-skeleton {
    height: 5rem;
    border-radius: var(--radius-lg);
    background: linear-gradient(90deg, var(--color-border) 25%, rgba(255,255,255,0.6) 50%, var(--color-border) 75%);
    background-size: 200% 100%;
    animation: eventPageShimmer 1.4s infinite;
    @keyframes eventPageShimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  }

  &-statCard {
    background: var(--light-bg);
    border-radius: var(--radius-lg);
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  &-statCardDate {
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-statGrid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-sm);
    @include mobile { grid-template-columns: repeat(2, 1fr); }
  }

  &-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-2xs);
    padding: var(--spacing-sm);
    background: var(--color-background);
    border-radius: var(--radius-md);
    text-align: center;
    &--views    { color: var(--brand-dark-green); }
    &--unique   { color: var(--brand-light-green); }
    &--blue     { color: var(--brand-dark-blue); }
    &--lightblue { color: var(--brand-light-blue); }
  }

  &-statLabel {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  &-statValue {
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: inherit;
    line-height: 1;
  }

  &-statLinksList { display: flex; flex-direction: column; gap: var(--spacing-xs); }

  &-linkBreakdown {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--color-background);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
  }

  &-linkBreakdownTitle { color: var(--color-text); }
  &-linkBreakdownCount { font-weight: 700; color: var(--brand-dark-blue); }

  &-statsEmpty {
    margin: 0;
    text-align: center;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    padding: var(--spacing-md) 0;
  }
}
</style>

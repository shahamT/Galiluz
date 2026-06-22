<template>
  <div class="EventPage-body">
    <Transition name="EventPage-bannerFade">
      <div v-if="successBanner" class="EventPage-successBanner">
        <UiIcon name="check_circle" size="sm" />
        {{ successBanner }}
      </div>
    </Transition>

    <div class="EventPage-header">
      <div class="EventPage-backRow">
        <NuxtLink :to="backTo" class="EventPage-back">
          <UiIcon name="arrow_forward" size="sm" />
          {{ backLabel }}
        </NuxtLink>
        <span v-if="event && !event.isActive" class="EventPage-draftChip">טיוטה</span>
      </div>
      <div class="EventPage-headerRow">
        <h1 v-if="event" class="EventPage-title">{{ event.title }}</h1>
        <div v-else class="EventPage-titleSkeleton" />
      </div>
    </div>

    <template v-if="pending">
      <div v-for="i in 4" :key="i" class="EventPage-skeleton" />
    </template>

    <template v-else-if="event">
      <PublisherEventViewSwitch v-model="activeView" :show-stats="showStats" />

      <template v-if="activeView === 'actions'">
        <div class="EventPage-actionsCard">
          <h3 class="EventPage-sectionTitle"><UiIcon name="tune" size="sm" />פעולות</h3>
          <template v-if="!event.isActive">
            <p class="EventPage-draftNoticeText">האירוע שלכם שמור כטיוטה, על מנת לפרסם אותו, לחצו כאן:</p>
            <button type="button" class="EventPage-actionBtn EventPage-actionBtn--publish" @click="showStatusModal = true">
              <UiIcon name="publish" size="sm" />
              פירסום אירוע
            </button>
            <div class="EventPage-actionsMore">
              <span class="EventPage-actionsMoreLabel">פעולות נוספות</span>
              <div class="EventPage-actionsRow">
                <button type="button" class="EventPage-actionBtn EventPage-actionBtn--edit" @click="showEditForm = true">
                  <UiIcon name="edit" size="sm" />
                  עדכון פרטים
                </button>
                <button type="button" class="EventPage-actionBtn EventPage-actionBtn--ghost-delete" @click="showDeleteModal = true">
                  <UiIcon name="delete" size="sm" />
                  מחיקת אירוע
                </button>
              </div>
            </div>
          </template>

          <template v-else>
            <button type="button" class="EventPage-actionBtn EventPage-actionBtn--edit" @click="showEditForm = true">
              <UiIcon name="edit" size="sm" />
              עדכון פרטים
            </button>
            <div class="EventPage-actionsMore">
              <span class="EventPage-actionsMoreLabel">פעולות נוספות</span>
              <div class="EventPage-actionsRow">
                <button type="button" class="EventPage-actionBtn EventPage-actionBtn--ghost-delete" @click="showDeleteModal = true">
                  <UiIcon name="delete" size="sm" />
                  מחיקת אירוע
                </button>
                <button type="button" class="EventPage-actionBtn EventPage-actionBtn--ghost-draft" @click="showStatusModal = true">
                  <UiIcon name="draft_orders" size="sm" />
                  המרה לטיוטה
                </button>
                <button
                  v-if="allowTransfer && authStore.isManager"
                  type="button"
                  class="EventPage-actionBtn EventPage-actionBtn--ghost-draft"
                  @click="showTransferModal = true"
                >
                  <UiIcon name="swap_horiz" size="sm" />
                  העברה למפרסם אחר
                </button>
              </div>
            </div>
          </template>
        </div>

        <div class="EventPage-linkBox">
          <h3 class="EventPage-sectionTitle"><UiIcon name="link" size="sm" />לינק לאירוע</h3>
          <template v-if="!event.isActive">
            <p class="EventPage-linkBoxMsg">האירוע מוגדר כטיוטה, על מנת לצפות בלינק לאירוע יש לפרסם אותו</p>
            <button type="button" class="EventPage-actionBtn EventPage-actionBtn--publish" @click="showStatusModal = true">
              <UiIcon name="publish" size="sm" />
              פירסום אירוע
            </button>
          </template>
          <template v-else-if="!firstFutureOccurrence">
            <p class="EventPage-linkBoxMsg">לאירוע זה לא קיימים מופעים עתידיים</p>
          </template>
          <template v-else>
            <div class="EventPage-linkRow">
              <a class="EventPage-linkUrl" :href="eventScheduleUrl" target="_blank" rel="noopener noreferrer">{{ eventScheduleUrl }}</a>
              <div class="EventPage-linkActions">
                <button type="button" class="EventPage-linkBtn" @click="copyEventLink">
                  <UiIcon :name="linkCopied ? 'check' : 'content_copy'" size="sm" />
                  {{ linkCopied ? 'הועתק!' : 'העתקה' }}
                </button>
                <button v-if="canShare" type="button" class="EventPage-linkBtn" @click="shareEventLink">
                  <UiIcon name="share" size="sm" />
                  שיתוף
                </button>
              </div>
            </div>
          </template>
        </div>
      </template>

      <template v-else-if="activeView === 'preview'">
        <PublisherEventPreview :event="event" />
      </template>

      <template v-else-if="showStats && event.stats">
        <template v-if="event.multiDayEvent">
          <div class="EventPage-statCard">
            <div class="EventPage-statSection">
              <span class="EventPage-statSectionTitle">צפיות באירוע</span>
              <div class="EventPage-statGrid EventPage-statGrid--entries">
                <div class="EventPage-stat EventPage-stat--views">
                  <UiIcon name="visibility" size="md" />
                  <span class="EventPage-statLabel">צפיות באירוע</span>
                  <span class="EventPage-statValue">{{ event.stats.totalViews }}</span>
                </div>
                <div class="EventPage-stat EventPage-stat--unique">
                  <UiIcon name="person" size="md" />
                  <span class="EventPage-statLabel">מבקרים ייחודיים</span>
                  <span class="EventPage-statValue">{{ event.stats.totalUniqueViews }}</span>
                </div>
              </div>
            </div>
            <div class="EventPage-statSection">
              <span class="EventPage-statSectionTitle">אינטרקציות</span>
              <div class="EventPage-statList">
                <div class="EventPage-statListItem">
                  <UiIcon name="share" size="sm" class="EventPage-statListIcon" />
                  <span class="EventPage-statListLabel">שיתופים</span>
                  <span class="EventPage-statListCount">{{ event.stats.shares }}</span>
                </div>
                <div class="EventPage-statListItem">
                  <UiIcon name="navigation" size="sm" class="EventPage-statListIcon" />
                  <span class="EventPage-statListLabel">ניווט</span>
                  <span class="EventPage-statListCount">{{ event.stats.navClicks }}</span>
                </div>
                <div class="EventPage-statListItem">
                  <UiIcon name="calendar_add_on" size="sm" class="EventPage-statListIcon" />
                  <span class="EventPage-statListLabel">הוספה ליומן</span>
                  <span class="EventPage-statListCount">{{ event.stats.calendarAdds }}</span>
                </div>
                <div class="EventPage-statListItem">
                  <UiIcon name="contact_phone" size="sm" class="EventPage-statListIcon" />
                  <span class="EventPage-statListLabel">יצירת קשר</span>
                  <span class="EventPage-statListCount">{{ event.stats.contactClicks }}</span>
                </div>
              </div>
            </div>
            <div v-if="linksWithClicks.length" class="EventPage-statSection">
              <span class="EventPage-statSectionTitle">לינקים</span>
              <div class="EventPage-statList">
                <div v-for="link in linksWithClicks" :key="link.title" class="EventPage-statListItem">
                  <UiIcon :name="link.type === 'phone' ? 'phone' : 'link'" size="sm" class="EventPage-statListIcon" />
                  <span class="EventPage-statListLabel">{{ link.title }}</span>
                  <span class="EventPage-statListCount">{{ link.clicks }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="EventPage-statCard">
            <div class="EventPage-statDateRow">
              <label class="EventPage-statDateLabel" for="stat-date-select">
                בחרו את התאריך עבורו תרצו להציג סטטיסטיקות
              </label>
              <select id="stat-date-select" v-model="selectedStatDate" class="EventPage-statDateSelect">
                <option v-for="occ in sortedOccurrenceStats" :key="occ.date" :value="occ.date">
                  {{ formatStatLabel(occ.date) }}
                </option>
              </select>
            </div>
            <div class="EventPage-statSection">
              <span class="EventPage-statSectionTitle">צפיות באירוע</span>
              <div class="EventPage-statGrid EventPage-statGrid--entries">
                <div class="EventPage-stat EventPage-stat--views">
                  <UiIcon name="visibility" size="md" />
                  <span class="EventPage-statLabel">צפיות באירוע</span>
                  <span class="EventPage-statValue">{{ selectedOccStat?.views ?? 0 }}</span>
                </div>
                <div class="EventPage-stat EventPage-stat--unique">
                  <UiIcon name="person" size="md" />
                  <span class="EventPage-statLabel">מבקרים ייחודיים</span>
                  <span class="EventPage-statValue">{{ selectedOccStat?.uniqueViews ?? 0 }}</span>
                </div>
              </div>
            </div>
            <div class="EventPage-statSection">
              <span class="EventPage-statSectionTitle">אינטרקציות</span>
              <div class="EventPage-statList">
                <div class="EventPage-statListItem">
                  <UiIcon name="share" size="sm" class="EventPage-statListIcon" />
                  <span class="EventPage-statListLabel">שיתופים</span>
                  <span class="EventPage-statListCount">{{ event.stats.shares }}</span>
                </div>
                <div class="EventPage-statListItem">
                  <UiIcon name="navigation" size="sm" class="EventPage-statListIcon" />
                  <span class="EventPage-statListLabel">ניווט</span>
                  <span class="EventPage-statListCount">{{ event.stats.navClicks }}</span>
                </div>
                <div class="EventPage-statListItem">
                  <UiIcon name="calendar_add_on" size="sm" class="EventPage-statListIcon" />
                  <span class="EventPage-statListLabel">הוספה ליומן</span>
                  <span class="EventPage-statListCount">{{ selectedOccStat?.calendarAdds ?? 0 }}</span>
                </div>
                <div class="EventPage-statListItem">
                  <UiIcon name="contact_phone" size="sm" class="EventPage-statListIcon" />
                  <span class="EventPage-statListLabel">יצירת קשר</span>
                  <span class="EventPage-statListCount">{{ event.stats.contactClicks }}</span>
                </div>
              </div>
            </div>
            <div v-if="linksWithClicks.length" class="EventPage-statSection">
              <span class="EventPage-statSectionTitle">לינקים</span>
              <div class="EventPage-statList">
                <div v-for="link in linksWithClicks" :key="link.title" class="EventPage-statListItem">
                  <UiIcon :name="link.type === 'phone' ? 'phone' : 'link'" size="sm" class="EventPage-statListIcon" />
                  <span class="EventPage-statListLabel">{{ link.title }}</span>
                  <span class="EventPage-statListCount">{{ link.clicks }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>
    </template>
  </div>

  <PublisherEventFormModal
    v-if="showEditForm && event"
    mode="edit"
    :initial-data="event"
    :draft-key="route.query.draft || null"
    @close="showEditForm = false; clearDraftFromUrl()"
    @submitted="onEditSubmitted"
    @delete="onFormDelete"
  />

  <PublisherEventStatusModal
    v-if="showStatusModal && event"
    :event-id="event.id"
    :is-active="event.isActive"
    @close="showStatusModal = false"
    @updated="onStatusUpdated"
  />

  <PublisherEventDeleteModal
    v-if="showDeleteModal && event"
    :event-title="event.title"
    :event-id="event.id"
    :simple="isCrawlerDraft"
    @close="showDeleteModal = false"
    @deleted="onDeleted"
  />

  <AdminEventTransferModal
    v-if="showTransferModal && event"
    :event-id="event.id"
    :current-publisher-name="event.publisherName || ''"
    :current-publisher-id="event.publisherId || ''"
    @close="showTransferModal = false"
    @transferred="onTransferred"
  />

  <PublisherEventCreatedModal
    v-if="showCreatedModal && event"
    :event-id="event.id"
    @close="showCreatedModal = false"
    @published="onCreatedModalPublished"
  />

  <PublisherEventPublishedModal
    v-if="showPublishedModal && event"
    :url="eventScheduleUrl || ''"
    @close="showPublishedModal = false"
  />
</template>

<script setup>
defineOptions({ name: 'PublisherEventDetailView' })

const props = defineProps({
  backTo:    { type: String, default: '/publisher/events' },
  backLabel:     { type: String,  default: 'חזרה לאירועים שלי' },
  allowTransfer: { type: Boolean, default: false },
})

const route = useRoute()
const router = useRouter()
const showDeleteModal = ref(false)
const showEditForm = ref(false)
const showStatusModal = ref(false)
const showTransferModal = ref(false)
const authStore = useAuthStore()

// Per-event statistics entitlement (managers bypass via the resolved feature map).
// Drives the stats tab + panel; the server independently omits the stats payload.
const showStats = computed(() => authStore.hasFeature('perEventStats'))

const activeView = ref('actions')

const successBanner = ref('')
const showCreatedModal = ref(false)
const showPublishedModal = ref(false)
let bannerTimer = null

function flashBanner(text) {
  successBanner.value = text
  clearTimeout(bannerTimer)
  bannerTimer = setTimeout(() => { successBanner.value = '' }, 4000)
}

onUnmounted(() => clearTimeout(bannerTimer))

onMounted(() => {
  if (route.query.modal === 'edit') showEditForm.value = true

  const s = route.query.success
  if (s === 'created') {
    showCreatedModal.value = true
    router.replace({ query: {} })
  } else if (s === 'updated') {
    flashBanner('האירוע עודכן בהצלחה!')
    router.replace({ query: {} })
  }
})

const { capture } = usePosthog()

async function onCreatedModalPublished() {
  showCreatedModal.value = false
  capture('publisher_event_status_changed', { eventId: route.params.id, isActive: true, source: 'created_modal' })
  await refresh() // event now active → eventScheduleUrl is populated for the success modal
  showPublishedModal.value = true
}

function clearDraftFromUrl() {
  if (route.query.modal || route.query.draft) router.replace({ query: {} })
}

async function onEditSubmitted() {
  showEditForm.value = false
  capture('publisher_event_edited', { eventId: route.params.id })
  await refresh()
  // Clear any stale ?modal=edit / ?draft / ?success left in the URL (e.g. the crawler magic link).
  if (route.query.modal || route.query.draft || route.query.success) router.replace({ query: {} })
  // Saving a still-draft event → encourage publishing (same modal as after create);
  // an already-published event just confirms the update.
  if (!event.value?.isActive) showCreatedModal.value = true
  else flashBanner('האירוע עודכן בהצלחה!')
}

// Draft-only "delete" from inside the edit modal → close it and open the existing
// type-to-confirm delete modal (which handles deletion + navigation away).
function onFormDelete() {
  showEditForm.value = false
  nextTick(() => { showDeleteModal.value = true })
}

async function onStatusUpdated() {
  showStatusModal.value = false
  const wasActive = event.value?.isActive
  capture('publisher_event_status_changed', { eventId: route.params.id, isActive: !wasActive })
  await refresh()
  // Draft → published: surface the success modal with the event link. (Publish → draft shows nothing new.)
  if (!wasActive && event.value?.isActive) showPublishedModal.value = true
}

async function onTransferred() {
  showTransferModal.value = false
  await refresh()
  flashBanner('האירוע הועבר בהצלחה!')
}

function onDeleted() {
  capture('publisher_event_deleted', { eventId: route.params.id })
  navigateTo(props.backTo)
}

const { data: event, pending, refresh } = useAuthFetch(`/api/publisher/event/${route.params.id}`)

// An unreviewed crawler-generated draft → delete with a plain "are you sure?" (no
// type-the-title), since the publisher didn't author it. Published events stay hard-confirm.
const isCrawlerDraft = computed(() => !!event.value?.createdByCrawler && event.value?.isActive === false)

useHead(computed(() => ({ title: event.value ? `${event.value.title} | גלילו"ז` : 'פרטי אירוע | גלילו"ז' })))

const linksWithClicks = computed(() => {
  const urls = event.value?.urls || []
  const breakdown = event.value?.stats?.linkBreakdown || []
  const breakdownMap = new Map(breakdown.map(b => [b.title.toLowerCase().trim(), b.clicks]))
  return urls.map(u => ({
    title: u.Title,
    type: u.type,
    clicks: breakdownMap.get((u.Title || '').toLowerCase().trim()) || 0,
  }))
})

// The schedule feed flattens each occurrence into its own "flat event" with id
// `${eventId}-${occurrenceIndex}` (utils/events.service.js), and the daily-view modal
// opens by matching that flat id — so the deep link needs the occurrence-index suffix,
// not the bare event id. Use the index of the first future occurrence in the (unfiltered,
// stored-order) occurrences array, which matches the feed's flat index.
const firstFutureOccurrenceIndex = computed(() => {
  const occs = event.value?.occurrences || []
  const today = new Date().toISOString().slice(0, 10)
  return occs.findIndex(o => o.date >= today)
})
const firstFutureOccurrence = computed(() => {
  const i = firstFutureOccurrenceIndex.value
  return i >= 0 ? (event.value?.occurrences || [])[i] : null
})

const eventScheduleUrl = computed(() => {
  if (!event.value?.isActive || !firstFutureOccurrence.value) return null
  const origin = process.client ? window.location.origin : ''
  return `${origin}/events/daily-view?date=${firstFutureOccurrence.value.date}&event=${event.value.id}-${firstFutureOccurrenceIndex.value}`
})

const canShare = computed(() => process.client && !!navigator.share)
const linkCopied = ref(false)

async function copyEventLink() {
  if (!eventScheduleUrl.value) return
  await navigator.clipboard.writeText(eventScheduleUrl.value)
  linkCopied.value = true
  setTimeout(() => { linkCopied.value = false }, 2000)
}

async function shareEventLink() {
  if (!eventScheduleUrl.value || !navigator.share) return
  await navigator.share({ title: event.value?.title, url: eventScheduleUrl.value })
}

const sortedOccurrenceStats = computed(() => {
  const statsMap = new Map(
    (event.value?.stats?.occurrenceStats || []).map(o => [o.date, o])
  )
  return [...(event.value?.occurrences || [])]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(occ => statsMap.get(occ.date) ?? { date: occ.date, views: 0, uniqueViews: 0, calendarAdds: 0 })
})

const selectedStatDate = ref(null)
watch(sortedOccurrenceStats, (occs) => {
  if (occs.length && !selectedStatDate.value) selectedStatDate.value = occs[0].date
}, { immediate: true })

const selectedOccStat = computed(() =>
  sortedOccurrenceStats.value.find(o => o.date === selectedStatDate.value) ?? null
)

function formatStatLabel(dateStr) {
  const [y, m, d] = dateStr.split('-')
  const dt = new Date(+y, +m - 1, +d)
  const weekday = dt.toLocaleDateString('he-IL', { weekday: 'long' })
  return `${weekday}, ${d.padStart(2,'0')}.${m.padStart(2,'0')}.${y}`
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

  &-backRow {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &-headerRow {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  &-draftChip {
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.6rem;
    border-radius: var(--radius-full);
    font-size: var(--font-size-xs);
    font-weight: 500;
    background: var(--color-border);
    color: var(--color-text-light);
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
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--brand-dark-green);
    min-width: 0;
  }

  &-titleSkeleton {
    flex: 1;
    height: 1.8rem;
    border-radius: var(--radius-sm);
    background: var(--color-border);
  }

  &-sectionTitle {
    margin: 0;
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--brand-dark-green);
    padding-bottom: var(--spacing-sm);
    border-bottom: 1.5px solid var(--color-border);
  }

  &-actionsCard {
    background: var(--light-bg);
    border-radius: var(--radius-lg);
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  &-draftNoticeText {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text);
  }

  &-actionsMore {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--color-border);
  }

  &-actionsMoreLabel {
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--color-text-muted);
  }

  &-actionsRow {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
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
    transition: opacity 0.15s, background 0.15s;

    &--edit {
      border: none;
      background: var(--brand-dark-blue);
      color: #fff;
      align-self: flex-start;
      &:hover { opacity: 0.88; }
    }

    &--publish {
      border: none;
      background: var(--brand-dark-green);
      color: #fff;
      align-self: flex-start;
      &:hover { opacity: 0.88; }
    }

    &--ghost-delete {
      background: var(--color-background);
      border: 1.5px solid var(--color-border);
      color: var(--color-error);
      align-self: flex-start;
      &:hover { background: var(--light-bg); }
    }

    &--ghost-draft {
      background: var(--color-background);
      border: 1.5px solid var(--color-border);
      color: var(--color-text);
      align-self: flex-start;
      &:hover { background: var(--light-bg); }
    }
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

  &-statDateRow {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  &-statDateLabel {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-muted);
  }

  &-statDateSelect {
    align-self: flex-start;
    min-width: 14rem;
    height: var(--control-height);
    padding: 0 var(--spacing-md);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    color: var(--color-text);
    cursor: pointer;
    &:focus { outline: none; border-color: var(--brand-dark-green); }
    @include mobile {
      height: var(--section-header-height);
      width: 100%;
      min-width: 0;
      align-self: stretch;
    }
  }

  &-statSection {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    & + & {
      padding-top: var(--spacing-md);
      border-top: 1px solid var(--color-border);
    }
  }

  &-statSectionTitle {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-muted);
  }

  &-statList {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    max-width: 28rem;
    @include mobile { max-width: none; }
  }

  &-statListItem {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-xs) var(--spacing-md);
    background: var(--color-background);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
  }

  &-statListIcon { color: var(--color-text-muted); flex-shrink: 0; }
  &-statListLabel { flex: 1; color: var(--color-text); }
  &-statListCount { font-weight: 700; color: var(--brand-dark-blue); }

  &-statGrid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-sm);
    @include mobile { grid-template-columns: repeat(2, 1fr); }
    &--entries {
      grid-template-columns: repeat(2, 1fr);
      .EventPage-statValue { font-size: var(--font-size-3xl); }
    }
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
    font-size: var(--font-size-sm);
    color: var(--color-text);
  }

  &-statValue {
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: inherit;
    line-height: 1;
  }

  &-linkBox {
    background: var(--light-bg);
    border-radius: var(--radius-lg);
    padding: var(--spacing-md) var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  &-linkBoxTitle {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-muted);
  }

  &-linkBoxMsg {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  &-linkRow {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    flex-wrap: wrap;
  }

  &-linkUrl {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--brand-dark-blue);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    direction: ltr;
    text-decoration: none;
    &:hover { text-decoration: underline; }
    @media (max-width: 768px) { width: 100%; flex: none; }
  }

  &-linkActions {
    display: flex;
    gap: var(--spacing-xs);
    flex-shrink: 0;
  }

  &-linkBtn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    height: var(--control-height);
    padding: 0 var(--spacing-md);
    border-radius: var(--radius-md);
    border: 1.5px solid var(--color-border);
    background: var(--color-background);
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: var(--font-family-body);
    color: var(--color-text);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
    &:hover { background: var(--light-bg); }
  }
}
</style>

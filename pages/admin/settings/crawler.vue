<template>
  <div class="CrawlerSettings">
    <!-- Mobile drill-in: back to the settings list -->
    <NuxtLink to="/admin/settings" class="CrawlerSettings-back">
      <UiIcon name="arrow_forward" size="sm" />
      חזרה להגדרות
    </NuxtLink>

    <header class="CrawlerSettings-header">
      <h1 class="CrawlerSettings-title">קראולר וואטסאפ — טיוטות אוטומטית</h1>
      <p class="CrawlerSettings-desc">
        כשמפרסם מאושר שהופעל עבורו הקראולר מפרסם אירוע חדש באחת מהקבוצות שלמטה, המערכת מזהה זאת ויוצרת עבורו טיוטת אירוע בגלילו"ז.
      </p>
    </header>

    <!-- Global toggle -->
    <section class="CrawlerSettings-card">
      <div class="CrawlerSettings-toggleRow">
        <div class="CrawlerSettings-toggleText">
          <span class="CrawlerSettings-toggleLabel">הפעלת הקראולר (גלובלי)</span>
          <span class="CrawlerSettings-toggleHint">מתג ראשי — כשהוא כבוי, המערכת לא יוצרת טיוטות מאף קבוצה.</span>
        </div>
        <button
          type="button"
          role="switch"
          :aria-checked="enabled"
          class="CrawlerSettings-switch"
          :class="{ 'CrawlerSettings-switch--on': enabled }"
          :disabled="savingToggle"
          @click="toggleEnabled"
        >
          <span class="CrawlerSettings-switchKnob" />
        </button>
      </div>
    </section>

    <!-- Groups -->
    <section class="CrawlerSettings-card">
      <div class="CrawlerSettings-sectionHead">
        <h2 class="CrawlerSettings-sectionTitle">קבוצות במעקב</h2>
        <button type="button" class="CrawlerSettings-addBtn" @click="showAddGroup = true">
          <UiIcon name="add" size="sm" /> הוספת קבוצה
        </button>
      </div>
      <template v-if="groups.length">
        <input
          v-if="groups.length > PAGE_SIZE"
          v-model="groupSearch"
          type="text"
          class="CrawlerSettings-search"
          placeholder="חיפוש קבוצה…"
        />
        <ul v-if="filteredGroups.length" class="CrawlerSettings-list">
          <li v-for="g in pagedGroups" :key="g.chatId" class="CrawlerSettings-item">
            <UiIcon name="groups" size="sm" class="CrawlerSettings-itemIcon" />
            <span class="CrawlerSettings-itemName">{{ g.name || g.chatId }}</span>
            <button type="button" class="CrawlerSettings-remove" aria-label="הסרה" @click="removeGroup(g.chatId)">
              <UiIcon name="delete" size="sm" />
            </button>
          </li>
        </ul>
        <p v-else class="CrawlerSettings-empty">לא נמצאו קבוצות.</p>
        <UiPaginator v-model:page="groupPage" :total="filteredGroups.length" :page-size="PAGE_SIZE" />
      </template>
      <p v-else class="CrawlerSettings-empty">לא נוספו קבוצות עדיין.</p>
    </section>

    <!-- Opted-in publishers -->
    <section class="CrawlerSettings-card">
      <div class="CrawlerSettings-sectionHead">
        <h2 class="CrawlerSettings-sectionTitle">מפרסמים מופעלים</h2>
      </div>
      <p class="CrawlerSettings-sectionHint">מפרסמים שעבורם הקראולר פעיל. מוצגים רק מפרסמים מאושרים.</p>

      <AdminPublisherSelect
        :model-value="null"
        :publishers="selectablePublishers"
        @update:model-value="onPublisherPicked"
      />

      <template v-if="optedInPublishers.length">
        <input
          v-if="optedInPublishers.length > PAGE_SIZE"
          v-model="pubSearch"
          type="text"
          class="CrawlerSettings-search"
          placeholder="חיפוש מפרסם…"
        />
        <ul v-if="filteredPubs.length" class="CrawlerSettings-list CrawlerSettings-list--pubs">
          <li v-for="p in pagedPubs" :key="p.id" class="CrawlerSettings-item">
            <UiIcon name="person" size="sm" class="CrawlerSettings-itemIcon" />
            <span class="CrawlerSettings-itemName">
              {{ p.fullName || p.publishingAs || p.waId }}
              <span class="CrawlerSettings-itemSub" dir="ltr">{{ formatPhone(p.waId) }}</span>
            </span>
            <button type="button" class="CrawlerSettings-remove" aria-label="כיבוי" @click="setPublisher(p.id, false)">
              <UiIcon name="delete" size="sm" />
            </button>
          </li>
        </ul>
        <p v-else class="CrawlerSettings-empty">לא נמצאו מפרסמים.</p>
        <UiPaginator v-model:page="pubPage" :total="filteredPubs.length" :page-size="PAGE_SIZE" />
      </template>
      <p v-else class="CrawlerSettings-empty">אין מפרסמים מופעלים.</p>
    </section>

    <AdminSettingsAddGroupModal
      v-if="showAddGroup"
      :existing-chat-ids="groups.map((g) => g.chatId)"
      @close="showAddGroup = false"
      @added="onGroupAdded"
    />
  </div>
</template>

<script setup>
defineOptions({ name: 'AdminSettingsCrawler' })

const enabled = ref(false)
const groups = ref([])
const optedInPublishers = ref([])
const allPublishers = ref([])
const savingToggle = ref(false)
const showAddGroup = ref(false)

const optedInIds = computed(() => new Set(optedInPublishers.value.map((p) => p.id)))
// Picker shows approved publishers not already opted in.
const selectablePublishers = computed(() =>
  allPublishers.value.filter((p) => p.status === 'approved' && !optedInIds.value.has(p.id)),
)

// Tracked-list search + pagination (client-side; both lists are already fully loaded).
const PAGE_SIZE = 10

const groupSearch = ref('')
const groupPage = ref(1)
const filteredGroups = computed(() => {
  const q = groupSearch.value.trim().toLowerCase()
  if (!q) return groups.value
  return groups.value.filter((g) => (g.name || g.chatId || '').toLowerCase().includes(q))
})
const groupPages = computed(() => Math.max(1, Math.ceil(filteredGroups.value.length / PAGE_SIZE)))
const pagedGroups = computed(() => filteredGroups.value.slice((groupPage.value - 1) * PAGE_SIZE, groupPage.value * PAGE_SIZE))

const pubSearch = ref('')
const pubPage = ref(1)
const filteredPubs = computed(() => {
  const q = pubSearch.value.trim().toLowerCase()
  if (!q) return optedInPublishers.value
  return optedInPublishers.value.filter((p) => {
    const name = (p.fullName || p.publishingAs || p.waId || '').toLowerCase()
    return name.includes(q) || (p.waId || '').includes(q)
  })
})
const pubPages = computed(() => Math.max(1, Math.ceil(filteredPubs.value.length / PAGE_SIZE)))
const pagedPubs = computed(() => filteredPubs.value.slice((pubPage.value - 1) * PAGE_SIZE, pubPage.value * PAGE_SIZE))

// Reset to page 1 on a new search; clamp the page if the list shrinks (search / remove).
watch(groupSearch, () => { groupPage.value = 1 })
watch(groupPages, (n) => { if (groupPage.value > n) groupPage.value = n })
watch(pubSearch, () => { pubPage.value = 1 })
watch(pubPages, (n) => { if (pubPage.value > n) pubPage.value = n })

function formatPhone(waId) {
  return (waId || '').replace(/^972/, '0')
}

async function loadSettings() {
  const res = await $fetch('/api/admin/settings/crawler')
  enabled.value = res?.enabled === true
  groups.value = Array.isArray(res?.groups) ? res.groups : []
}
async function loadPublishers() {
  const [opted, all] = await Promise.all([
    $fetch('/api/admin/crawler-publishers'),
    $fetch('/api/admin/publishers'),
  ])
  optedInPublishers.value = Array.isArray(opted) ? opted : []
  allPublishers.value = Array.isArray(all?.publishers) ? all.publishers : []
}

async function toggleEnabled() {
  if (savingToggle.value) return
  savingToggle.value = true
  const next = !enabled.value
  try {
    await $fetch('/api/admin/settings/crawler', { method: 'PATCH', body: { enabled: next } })
    enabled.value = next
  } catch (err) {
    console.error('[crawler-settings] toggle failed', err)
  } finally {
    savingToggle.value = false
  }
}

function onGroupAdded() {
  showAddGroup.value = false
  loadSettings()
}
async function removeGroup(chatId) {
  try {
    await $fetch(`/api/admin/settings/crawler/groups/${encodeURIComponent(chatId)}`, { method: 'DELETE' })
    await loadSettings()
  } catch (err) {
    console.error('[crawler-settings] remove group failed', err)
  }
}

function onPublisherPicked(pub) {
  if (pub?.id) setPublisher(pub.id, true)
}
async function setPublisher(id, on) {
  try {
    await $fetch(`/api/admin/publisher/${id}/preferences`, {
      method: 'PATCH',
      body: { autoGenerateDraftsByCrawler: on },
    })
    await loadPublishers()
  } catch (err) {
    console.error('[crawler-settings] set publisher pref failed', err)
  }
}

onMounted(() => {
  loadSettings()
  loadPublishers()
})
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.CrawlerSettings {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);

  &-back {
    display: none;
    align-items: center;
    gap: var(--spacing-xs);
    color: var(--brand-dark-green);
    text-decoration: none;
    font-size: var(--font-size-sm);
    font-weight: 600;
    @include mobile { display: inline-flex; }
  }

  &-header { display: flex; flex-direction: column; gap: var(--spacing-xs); }
  &-title { margin: 0; font-size: var(--font-size-xl); font-weight: 700; color: var(--brand-dark-green); }
  &-desc { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-light); line-height: 1.6; }

  &-card {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  &-toggleRow { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-md); }
  &-toggleText { display: flex; flex-direction: column; gap: 2px; }
  &-toggleLabel { font-weight: 700; color: var(--color-text); }
  &-toggleHint { font-size: var(--font-size-sm); color: var(--color-text-light); }

  &-switch {
    flex-shrink: 0;
    width: 3rem; height: 1.6rem;
    border: none; border-radius: var(--radius-full);
    background: var(--color-border); cursor: pointer; position: relative;
    transition: background 0.2s;
    &--on { background: var(--brand-dark-green); }
    &:disabled { opacity: 0.6; cursor: default; }
  }
  &-switchKnob {
    position: absolute; top: 0.2rem; right: 0.2rem;
    width: 1.2rem; height: 1.2rem; border-radius: 50%; background: #fff;
    transition: transform 0.2s;
    .CrawlerSettings-switch--on & { transform: translateX(-1.4rem); }
  }

  &-sectionHead { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); }
  &-sectionTitle { margin: 0; font-size: var(--font-size-lg); font-weight: 600; color: var(--brand-dark-green); }
  &-sectionHint { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-light); }

  &-addBtn {
    display: inline-flex; align-items: center; gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-md);
    border: 1.5px solid var(--brand-dark-green); border-radius: var(--radius-md);
    background: transparent; color: var(--brand-dark-green);
    font-family: var(--font-family-body); font-size: var(--font-size-sm); font-weight: 600; cursor: pointer;
    transition: background 0.15s;
    &:hover { background: var(--brand-light-green-hover); }
  }

  &-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--spacing-xs); }
  &-list--pubs { margin-top: var(--spacing-sm); }
  &-item {
    display: flex; align-items: center; gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--light-bg); border-radius: var(--radius-md);
  }
  &-itemIcon { color: var(--color-text-light); flex-shrink: 0; }
  &-itemName { flex: 1; font-weight: 600; font-size: var(--font-size-sm); min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  &-itemSub { font-weight: 400; font-size: var(--font-size-xs); color: var(--color-text-light); }
  &-remove {
    flex-shrink: 0; background: none; border: none; cursor: pointer; color: var(--color-text-light);
    border-radius: var(--radius-full); padding: 4px; display: inline-flex;
    &:hover { background: rgba(0,0,0,0.06); color: var(--color-error); }
  }
  &-empty { margin: 0; color: var(--color-text-muted); font-size: var(--font-size-sm); }

  &-search {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    color: var(--color-text);
    direction: rtl;
    &:focus { border-color: var(--brand-dark-green); outline: none; }
    &::placeholder { color: var(--color-text-muted); }
  }
}
</style>

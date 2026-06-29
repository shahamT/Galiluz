<template>
  <div class="PubList">
    <div class="PubList-header">
      <h1 class="PubList-title">מפרסמים</h1>
      <p class="PubList-desc">כל המפרסמים בפלטפורמה — חשבון, תפקיד, סטטוס ומספר אירועים.</p>
    </div>

    <div class="PubList-container">
      <div class="PubList-controls">
      <div class="PubList-searchRow">
        <UiIcon name="search" size="sm" class="PubList-searchIcon" />
        <input v-model="search" type="search" class="PubList-search" placeholder="חיפוש לפי שם או טלפון…" />
      </div>
      <div class="PubList-filters">
        <button
          v-for="opt in STATUS_FILTERS"
          :key="opt.value"
          type="button"
          class="PubList-filter"
          :class="{ 'PubList-filter--active': statusFilter === opt.value }"
          @click="statusFilter = opt.value"
        >{{ opt.label }}</button>
      </div>
    </div>

    <template v-if="pending">
      <div v-for="i in 8" :key="i" class="PubList-skeleton" />
    </template>

    <template v-else-if="filtered.length">
      <div class="PubList-rows">
        <AdminListItem
          v-for="p in filtered"
          :key="p.id"
          :to="`/admin/publisher/${p.id}`"
          :title="p.name || '—'"
          :avatar-text="initials(p.name)"
          avatar-icon="person"
          :title-chip="statusChip(p.status)"
          :muted="!p.isActive"
          :chips="publisherChips(p)"
        />
      </div>
    </template>

    <PublisherDashboardEmptyState
      v-else-if="isSearching || statusFilter !== 'all'"
      text="לא נמצאו מפרסמים מתאימים"
      button-label="איפוס"
      button-icon="close"
      @action="resetFilters"
    />
    <PublisherDashboardEmptyState v-else text="אין מפרסמים במערכת" :show-button="false" />
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'AdminPublishersList' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'מפרסמים | ניהול | גלילו"ז' })

const STATUS_FILTERS = [
  { value: 'all', label: 'הכל' },
  { value: 'approved', label: 'מאושרים' },
  { value: 'pending', label: 'ממתינים' },
  { value: 'inactive', label: 'מושהים' },
]

const search = ref('')
const statusFilter = ref('all')
const debounced = useDebounce(search, 200)
const isSearching = computed(() => !!debounced.value.trim())

const { data, pending } = await useAuthFetch('/api/admin/publishers/list')

function resetFilters() { search.value = ''; statusFilter.value = 'all' }
function initials(name) { return (String(name || '').trim().charAt(0) || '?').toUpperCase() }
// 972XXXXXXXXX → 0XX-XXXXXXX for display (best-effort).
function formatPhone(p) {
  const d = String(p || '').replace(/\D/g, '')
  if (d.startsWith('972') && d.length === 12) return `0${d.slice(3, 5)}-${d.slice(5)}`
  return p || ''
}
function statusChip(s) {
  return ({
    approved: { label: 'מאושר', variant: 'green' },
    pending: { label: 'ממתין', variant: 'warm' },
    ghost: { label: 'צללית', variant: 'neutral' },
  })[s] || null
}
function businessRoleLabel(r) { return ({ owner: 'בעלים', admin: 'מנהל' })[r] || r }
function platformRoleLabel(r) { return ({ platform_owner: 'בעלים', super_admin: 'מנהל-על', viewer: 'צופה' })[r] || r }

function publisherChips(p) {
  const chips = [{ label: formatPhone(p.phone), icon: 'call', variant: 'neutral' }]
  if (p.accountName) chips.push({ label: p.accountName, icon: 'apartment', variant: 'blue' })
  if (p.platformRole) chips.push({ label: platformRoleLabel(p.platformRole), icon: 'shield_person', variant: 'platform' })
  else if (p.businessRole) chips.push({ label: businessRoleLabel(p.businessRole), variant: 'neutral' })
  chips.push({ label: `${p.eventCount} אירועים`, icon: 'event_note', variant: 'green' })
  if (!p.isActive) chips.push({ label: 'מושהה', variant: 'danger' })
  return chips
}

const filtered = computed(() => {
  let list = data.value?.publishers || []
  if (statusFilter.value === 'inactive') list = list.filter((p) => !p.isActive)
  else if (statusFilter.value !== 'all') list = list.filter((p) => p.status === statusFilter.value)
  if (isSearching.value) {
    const q = debounced.value.trim().toLowerCase()
    list = list.filter((p) => (p.name || '').toLowerCase().includes(q) || (p.phone || '').includes(q))
  }
  return list
})
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.PubList {
  &-header { margin-bottom: var(--spacing-xl); }
  &-title { margin: 0 0 var(--spacing-xs); font-size: var(--font-size-2xl); font-weight: 700; color: var(--brand-dark-green); }
  &-desc { margin: 0; font-size: var(--font-size-base); color: var(--color-text-light); }

  &-container {
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.6);
    border-radius: var(--radius-lg);
    padding: var(--spacing-lg);
    @include mobile { padding: var(--spacing-md); }
  }

  &-controls { display: flex; flex-direction: column; gap: var(--spacing-sm); margin-bottom: var(--spacing-lg); }

  &-searchRow { position: relative; max-width: 24rem; @include mobile { max-width: none; } }
  &-searchIcon { position: absolute; inset-inline-start: var(--spacing-sm); top: 50%; transform: translateY(-50%); color: var(--color-text-light); pointer-events: none; }
  &-search {
    width: 100%;
    padding: var(--spacing-sm);
    padding-inline-start: calc(var(--spacing-sm) * 2 + 1.25rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    font-size: var(--font-size-base);
    font-family: inherit;
  }

  &-filters { display: flex; gap: var(--spacing-xs); flex-wrap: wrap; }
  &-filter {
    padding: var(--spacing-xs) var(--spacing-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-background);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-light);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    &--active { background: var(--brand-dark-green); color: #fff; border-color: var(--brand-dark-green); }
  }

  &-rows { display: flex; flex-direction: column; gap: var(--spacing-sm); }

  &-skeleton {
    height: 4.5rem; border-radius: var(--radius-lg); margin-bottom: var(--spacing-sm);
    background: linear-gradient(90deg, var(--color-border) 25%, rgba(255,255,255,0.6) 50%, var(--color-border) 75%);
    background-size: 200% 100%; animation: pubShimmer 1.4s infinite;
    @keyframes pubShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  }
}
</style>

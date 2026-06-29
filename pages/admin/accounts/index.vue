<template>
  <div class="AcctList">
    <div class="AcctList-header">
      <h1 class="AcctList-title">חשבונות</h1>
      <p class="AcctList-desc">כל החשבונות בפלטפורמה — מפרסמים ואירועים משויכים.</p>
    </div>

    <div class="AcctList-container">
      <div class="AcctList-searchRow">
        <UiIcon name="search" size="sm" class="AcctList-searchIcon" />
        <input v-model="search" type="search" class="AcctList-search" placeholder="חיפוש חשבון…" />
      </div>

      <template v-if="pending">
        <div v-for="i in 6" :key="i" class="AcctList-skeleton" />
      </template>

      <template v-else-if="filtered.length">
        <div class="AcctList-rows">
          <AdminListItem
            v-for="a in filtered"
            :key="a.id"
            :to="`/admin/account/${a.id}`"
            :title="a.title || '—'"
            :avatar-url="a.logo"
            :avatar-icon="a.kind === 'platform' ? 'shield_person' : 'apartment'"
            :avatar-variant="a.kind === 'platform' ? 'accent' : 'default'"
            :title-chip="a.kind === 'platform' ? { label: 'פלטפורמה', variant: 'platform' } : null"
            :muted="!a.isActive"
            :chips="accountChips(a)"
          />
        </div>
      </template>

      <PublisherDashboardEmptyState
        v-else-if="isSearching"
        text="לא נמצאו חשבונות מתאימים"
        button-label="איפוס"
        button-icon="close"
        @action="search = ''"
      />
      <PublisherDashboardEmptyState v-else text="אין חשבונות במערכת" :show-button="false" />
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'AdminAccountsList' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'חשבונות | ניהול | גלילו"ז' })

const search = ref('')
const debounced = useDebounce(search, 200)
const isSearching = computed(() => !!debounced.value.trim())

const { data, pending } = await useAuthFetch('/api/admin/accounts')

function accountChips(a) {
  const chips = [
    { label: `${a.publisherCount} מפרסמים`, icon: 'group', variant: 'green' },
  ]
  if (!a.isActive) chips.push({ label: 'מושהה', variant: 'danger' })
  return chips
}

const filtered = computed(() => {
  const list = data.value?.accounts || []
  if (!isSearching.value) return list
  const q = debounced.value.trim().toLowerCase()
  return list.filter((a) => (a.title || '').toLowerCase().includes(q))
})
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.AcctList {
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

  &-searchRow { position: relative; margin-bottom: var(--spacing-lg); max-width: 22rem; @include mobile { max-width: none; } }
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

  &-rows { display: flex; flex-direction: column; gap: var(--spacing-sm); }

  &-skeleton {
    height: 4.5rem; border-radius: var(--radius-lg); margin-bottom: var(--spacing-sm);
    background: linear-gradient(90deg, var(--color-border) 25%, rgba(255,255,255,0.6) 50%, var(--color-border) 75%);
    background-size: 200% 100%; animation: acctShimmer 1.4s infinite;
    @keyframes acctShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  }
}
</style>

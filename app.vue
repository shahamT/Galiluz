<template>
  <div class="App">
    <NuxtLoadingIndicator color="var(--brand-dark-green)" :height="3" />
    <NuxtPage />
    <EventModal v-if="isEventModalShowing && !isProtectedRoute" />
    <UiFilterNotifyBar
      :visible="filterNotifyStore.visible"
      :filter-summary="filterNotifyStore.filterSummary"
      @reset="filterNotifyStore.handleReset"
      @change-filters="filterNotifyStore.handleChangeFilters"
      @close="filterNotifyStore.handleClose"
    />
    <UiWelcomeModal v-if="!isProtectedRoute" />
  </div>
</template>

<script setup>
import { SEO_PAGES } from '~/consts/seo.const'

const uiStore = useUiStore()
const filterNotifyStore = useFilterNotifyStore()
const { isEventModalShowing } = storeToRefs(uiStore)
const route = useRoute()
const isProtectedRoute = computed(() =>
  route.path.startsWith('/publisher') || route.path.startsWith('/admin') || route.path === '/login'
)

const config = useRuntimeConfig()
const siteUrl = computed(() => config.public.siteUrl || 'https://galiluz.co.il')

usePageSeo({
  title: SEO_PAGES.default.title,
  description: SEO_PAGES.default.description,
})
useSiteJsonLd(siteUrl)
</script>

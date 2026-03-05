<template>
  <div class="App">
    <NuxtPage />
    <EventModal v-if="isEventModalShowing" />
    <UiFilterNotifyBar
      :visible="filterNotifyStore.visible"
      :filter-summary="filterNotifyStore.filterSummary"
      @reset="filterNotifyStore.handleReset"
      @change-filters="filterNotifyStore.handleChangeFilters"
      @close="filterNotifyStore.handleClose"
    />
    <UiWelcomeModal />
  </div>
</template>

<script setup>
const uiStore = useUiStore()
const filterNotifyStore = useFilterNotifyStore()
const { isEventModalShowing } = storeToRefs(uiStore)

const requestUrl = useRequestURL()
const ogImageUrl = new URL('/galiluz-thumbnail.png', requestUrl.origin).href
const socialTitle = 'גלילו"ז'
const socialDescription = 'גלילו״ז – יומן אירועים ופעילויות בגליל ובגולן. גלו מה קורה בצפון.'

useSeoMeta({
  title: socialTitle,
  description: socialDescription,
  ogTitle: socialTitle,
  ogDescription: socialDescription,
  ogImage: ogImageUrl,
  ogUrl: requestUrl.href,
  ogType: 'website',
  ogSiteName: 'גלילו"ז',
  ogLocale: 'he_IL',
  twitterCard: 'summary_large_image',
  twitterTitle: socialTitle,
  twitterDescription: socialDescription,
  twitterImage: ogImageUrl,
})
</script>

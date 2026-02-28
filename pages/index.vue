<template>
  <LayoutAppShell>
    <div class="IndexRedirect">
      <UiLoader size="md" />
    </div>
  </LayoutAppShell>
</template>

<script setup>
import { ROUTE_DAILY_VIEW } from '~/consts/calendar.const'
import { getTodayDateString } from '~/utils/date.helpers'

defineOptions({ name: 'IndexRedirect' })

// lifecycle
onMounted(() => {
  navigateTo({ path: ROUTE_DAILY_VIEW, query: { date: getTodayDateString() } }, { replace: true })
})
</script>

<style lang="scss">
.IndexRedirect {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

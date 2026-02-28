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

const route = useRoute()

// lifecycle
onMounted(() => {
  const query = route.query.event
    ? { event: route.query.event }
    : { date: getTodayDateString() }
  navigateTo({ path: ROUTE_DAILY_VIEW, query }, { replace: true })
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

<template>
  <div class="EventsIndexRedirect">
    <UiLoader size="md" />
  </div>
</template>

<script setup>
import { ROUTE_EVENTS_DAILY_VIEW } from '~/consts/calendar.const'
import { getTodayDateString } from '~/utils/date.helpers'

defineOptions({ name: 'EventsIndexRedirect' })

const route = useRoute()

onMounted(() => {
  const query = route.query.event
    ? { event: route.query.event }
    : { date: getTodayDateString() }
  navigateTo({ path: ROUTE_EVENTS_DAILY_VIEW, query }, { replace: true })
})
</script>

<style lang="scss">
.EventsIndexRedirect {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

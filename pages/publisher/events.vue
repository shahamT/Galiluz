<template>
  <LayoutProtectedShell>
    <PublisherNavTabs />
    <!-- TODO: publisher events list -->
  </LayoutProtectedShell>
</template>

<script setup>
defineOptions({ name: 'PublisherEvents' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'האירועים שלי | גלילו"ז' })
</script>

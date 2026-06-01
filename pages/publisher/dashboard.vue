<template>
  <LayoutProtectedShell>
    <PublisherNavTabs />
    <!-- TODO: publisher dashboard content -->
  </LayoutProtectedShell>
</template>

<script setup>
defineOptions({ name: 'PublisherDashboard' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'לוח בקרה | גלילו"ז' })
</script>

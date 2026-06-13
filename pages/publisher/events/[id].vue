<template>
  <LayoutProtectedShell>
    <template #nav>
      <PublisherNavTabs />
    </template>
    <PublisherEventDetailView />
  </LayoutProtectedShell>
</template>

<script setup>
defineOptions({ name: 'PublisherEventDetail' })
definePageMeta({ middleware: 'auth' })
</script>

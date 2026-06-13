<template>
  <LayoutProtectedShell>
    <template #nav>
      <AdminNavTabs />
    </template>
    <PublisherEventDetailView back-to="/admin/events" back-label="חזרה לאירועים" :allow-transfer="true" />
  </LayoutProtectedShell>
</template>

<script setup>
defineOptions({ name: 'AdminEventDetail' })
definePageMeta({ middleware: 'auth' })
</script>

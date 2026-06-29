<template>
  <LayoutProtectedShell>
    <template #nav>
      <AdminNavTabs />
    </template>
    <PublisherEventDetailView back-to="/admin/events" back-label="חזרה לאירועים" :allow-transfer="true" :can-manage="authStore.isSuperAdmin" />
  </LayoutProtectedShell>
</template>

<script setup>
defineOptions({ name: 'AdminEventDetail' })
definePageMeta({ middleware: 'auth' })
const authStore = useAuthStore()
</script>

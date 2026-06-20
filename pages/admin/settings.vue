<template>
  <LayoutProtectedShell>
    <template #nav>
      <AdminNavTabs />
    </template>

    <div class="AdminSettingsPage-body">
      <AdminSettingsLayout>
        <NuxtPage />
      </AdminSettingsLayout>
    </div>
  </LayoutProtectedShell>
</template>

<script setup>
defineOptions({ name: 'AdminSettingsPage' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'הגדרות | ניהול | גלילו"ז' })
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.AdminSettingsPage-body {
  flex: 1;
  display: flex;
  flex-direction: column;

  @include mobile {
    padding-inline: var(--spacing-md);
  }
}
</style>

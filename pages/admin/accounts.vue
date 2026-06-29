<template>
  <LayoutProtectedShell>
    <template #nav>
      <AdminNavTabs />
    </template>

    <div class="AdminAccounts-body">
      <AdminAccountsSubNav />
      <NuxtPage />
    </div>
  </LayoutProtectedShell>
</template>

<script setup>
defineOptions({ name: 'AdminAccountsLayout' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'חשבונות ומפרסמים | ניהול | גלילו"ז' })
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.AdminAccounts-body {
  flex: 1;
  display: flex;
  flex-direction: column;

  @include mobile {
    padding-inline: var(--spacing-md);
  }
}
</style>

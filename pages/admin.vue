<template>
  <LayoutProtectedShell>
    <LayoutContentCard>
      <div class="AdminPage">
        <h1 class="AdminPage-title">ניהול</h1>
        <p class="AdminPage-placeholder"><!-- TODO: admin dashboard --></p>
      </div>
    </LayoutContentCard>
  </LayoutProtectedShell>
</template>

<script setup>
defineOptions({ name: 'AdminPage' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'ניהול | גלילו"ז' })
</script>

<style lang="scss">
.AdminPage {
  padding: var(--spacing-xl);

  &-title {
    margin: 0 0 var(--spacing-md);
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-placeholder {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }
}
</style>

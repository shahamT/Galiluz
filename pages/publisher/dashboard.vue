<template>
  <LayoutAppShell>
    <LayoutContentCard>
      <div class="PublisherDashboard">
        <h1 class="PublisherDashboard-title">לוח בקרה</h1>
        <p class="PublisherDashboard-placeholder"><!-- TODO: publisher dashboard --></p>
      </div>
    </LayoutContentCard>
  </LayoutAppShell>
</template>

<script setup>
defineOptions({ name: 'PublisherDashboard' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'לוח בקרה | גלילו"ז' })
</script>

<style lang="scss">
.PublisherDashboard {
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

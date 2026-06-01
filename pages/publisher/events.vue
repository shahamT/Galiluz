<template>
  <LayoutAppShell>
    <LayoutContentCard>
      <div class="PublisherEvents">
        <h1 class="PublisherEvents-title">האירועים שלי</h1>
        <p class="PublisherEvents-placeholder"><!-- TODO: publisher events list --></p>
      </div>
    </LayoutContentCard>
  </LayoutAppShell>
</template>

<script setup>
defineOptions({ name: 'PublisherEvents' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'האירועים שלי | גלילו"ז' })
</script>

<style lang="scss">
.PublisherEvents {
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

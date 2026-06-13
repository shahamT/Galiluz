<template>
  <LayoutProtectedShell>
    <template #nav>
      <AdminNavTabs />
    </template>
    <div class="AdminPlaceholder-body">
      <div class="AdminPlaceholder-header">
        <h1 class="AdminPlaceholder-title">{{ title }}</h1>
        <p v-if="description" class="AdminPlaceholder-description">{{ description }}</p>
      </div>
      <div class="AdminPlaceholder-card">
        <UiIcon name="construction" size="xl" class="AdminPlaceholder-icon" />
        <span class="AdminPlaceholder-soon">בקרוב</span>
      </div>
    </div>
  </LayoutProtectedShell>
</template>

<script setup>
defineOptions({ name: 'AdminPlaceholderPage' })
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
})
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.AdminPlaceholder {
  &-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    @include mobile { padding-inline: var(--spacing-md); }
  }

  &-header { margin-bottom: var(--spacing-xl); }

  &-title {
    margin: 0 0 var(--spacing-xs);
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-description {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--color-text-light);
    line-height: 1.5;
  }

  &-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-3xl) var(--spacing-lg);
    border-radius: var(--radius-lg);
    background: var(--light-bg);
    color: var(--color-text-muted);
  }

  &-icon { color: var(--brand-dark-green-tint); }

  &-soon {
    font-size: var(--font-size-lg);
    font-weight: 700;
  }
}
</style>

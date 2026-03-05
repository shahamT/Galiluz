<template>
  <main class="ContentCard">
    <slot />
  </main>
</template>

<script setup>
defineOptions({ name: 'ContentCard' })
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.ContentCard {
  width: 100%;
  min-height: 600px;
  min-width: 0;
  background-color: var(--color-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: var(--spacing-xl);

  @include mobile {
    width: calc(100% - 2 * var(--spacing-md));
    min-height: 0;
    margin-inline: var(--spacing-md);
    margin-bottom: var(--spacing-md);
    padding: var(--spacing-md);
    padding-bottom: var(--spacing-2xl);
    border-radius: var(--radius-lg);
  }
}
</style>

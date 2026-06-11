<template>
  <div class="UiKanbanSkeleton">
    <div class="UiKanbanSkeleton-header">
      <div class="UiKanbanSkeleton-pill UiKanbanSkeleton-pill--wide" />
      <div class="UiKanbanSkeleton-pill UiKanbanSkeleton-pill--narrow" />
    </div>
    <div class="UiKanbanSkeleton-columns">
      <div v-for="col in 3" :key="col" class="UiKanbanSkeleton-column">
        <div class="UiKanbanSkeleton-columnHead" />
        <div class="UiKanbanSkeleton-columnBody">
          <div v-for="card in 3" :key="card" class="UiKanbanSkeleton-card" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'UiKanbanSkeleton' })
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

@keyframes UiKanbanSkeleton-shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

@mixin shimmer-block {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--brand-dark-green) 8%, white) 25%,
    color-mix(in srgb, var(--brand-dark-green) 15%, white) 50%,
    color-mix(in srgb, var(--brand-dark-green) 8%, white) 75%
  );
  background-size: 200% 100%;
  animation: UiKanbanSkeleton-shimmer 1.6s ease-in-out infinite;
}

.UiKanbanSkeleton {
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
  gap: var(--spacing-md);

  @include mobile {
    padding-inline: var(--spacing-md);
    padding-block: var(--spacing-md);
  }

  &-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    min-width: 0;
  }

  &-pill {
    height: 32px;
    border-radius: var(--radius-full);
    @include shimmer-block;

    &--wide { width: 200px; }
    &--narrow { width: 120px; }
  }

  &-columns {
    display: flex;
    gap: var(--spacing-md);
    min-height: 0;
    align-items: stretch;

    @include mobile {
      gap: var(--spacing-sm);
      overflow: hidden;
    }
  }

  &-column {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-lg);

    @include mobile {
      flex: 0 0 85vw;
      max-width: 85vw;

      &:nth-child(n+2) {
        display: none;
      }
    }
  }

  &-columnHead {
    height: var(--section-header-height);
    flex-shrink: 0;
    opacity: 0.8;
    @include shimmer-block;
  }

  &-columnBody {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm-lg);
    padding: var(--spacing-sm-lg);
    background-color: var(--light-bg);
  }

  &-card {
    height: 72px;
    border-radius: var(--radius-md);
    @include shimmer-block;
  }
}
</style>

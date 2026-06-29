<template>
  <nav class="AccountsSubNav">
    <NuxtLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="AccountsSubNav-tab"
      :class="{ 'AccountsSubNav-tab--active': route.path === item.to }"
    >
      <UiIcon :name="item.icon" size="sm" class="AccountsSubNav-icon" />
      <span class="AccountsSubNav-label">{{ item.label }}</span>
      <span v-if="item.badge" class="AccountsSubNav-badge">{{ item.badge > 99 ? '99+' : item.badge }}</span>
    </NuxtLink>
  </nav>
</template>

<script setup>
defineOptions({ name: 'AdminAccountsSubNav' })

const route = useRoute()
const { count: pendingCount } = useApprovalsCount()

const items = computed(() => [
  { to: '/admin/accounts', label: 'חשבונות', icon: 'apartment' },
  { to: '/admin/accounts/publishers', label: 'מפרסמים', icon: 'group' },
  { to: '/admin/accounts/approvals', label: 'בקשות אישור', icon: 'how_to_reg', badge: pendingCount.value },
])
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.AccountsSubNav {
  display: flex;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);

  @include mobile {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }

  &-tab {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-lg);
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-text-light);
    text-decoration: none;
    border-bottom: 3px solid transparent;
    white-space: nowrap;
    transition: color 0.15s, border-color 0.15s;

    &:hover { color: var(--brand-dark-green); }

    &--active {
      color: var(--brand-dark-green);
      border-bottom-color: var(--brand-dark-green);
      &:hover { color: var(--brand-dark-green); }
    }

    @include mobile { padding: var(--spacing-sm) var(--spacing-md); }
  }

  &-icon { flex-shrink: 0; color: inherit; }

  &-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 0.35rem;
    border-radius: 999px;
    background: var(--color-danger, #d33);
    color: #fff;
    font-size: var(--font-size-xs);
    font-weight: 700;
    line-height: 1;
  }
}
</style>

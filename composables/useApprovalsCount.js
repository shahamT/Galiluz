/**
 * Shared count of pending publisher-approval requests — drives the admin nav + sub-tab badges.
 * A fixed `key` makes NavTabs, the accounts sub-nav, and the approvals page share ONE fetch;
 * call refresh() after an approve/deny so every badge updates at once.
 */
export function useApprovalsCount() {
  const { data, refresh } = useAuthFetch('/api/admin/approvals/count', {
    key: 'admin-approvals-count',
    default: () => ({ count: 0 }),
  })
  const count = computed(() => data.value?.count || 0)
  return { count, refresh }
}

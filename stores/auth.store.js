export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const authReady = ref(false)
  const isLoggedIn = computed(() => !!user.value)
  /** Platform super-admin (full Galiluz management). The legacy `type==='manager'` still counts
   *  during the RBAC rollout, so this is byte-identical to the old `isManager` today. */
  const isSuperAdmin = computed(() => user.value?.platformRole === 'super_admin' || user.value?.type === 'manager')
  /** Any platform staff (super_admin or read-only viewer) — may see the admin portal. */
  const isPlatformStaff = computed(() => !!user.value?.platformRole || user.value?.type === 'manager')
  /** @deprecated alias of isSuperAdmin — kept for existing call sites (middleware, login, EventDetailView). */
  const isManager = isSuperAdmin
  /** @deprecated alias of isSuperAdmin. Super-admin can act on any resource. */
  const canManageAll = isSuperAdmin
  /** Any authenticated user can act on their own resources. */
  const canManageOwn = computed(() => !!user.value)
  /**
   * Account-level feature entitlement check (UI gating only — the server
   * independently withholds gated data). The server sends a fully-resolved map
   * (defaults applied; managers get every feature), so this just reads booleans.
   */
  const hasFeature = (key) => user.value?.features?.[key] === true
  /** Per-publisher preference check (resolved map from /api/auth/me; UI gating only). */
  const hasPreference = (key) => user.value?.preferences?.[key] === true

  function setUser(userData) {
    user.value = userData
  }

  function login(userData) {
    // Token is in HttpOnly cookie — never touches JavaScript
    user.value = userData
  }

  function logout() {
    user.value = null
    authReady.value = false
  }

  function setAuthReady() {
    authReady.value = true
  }

  function resetAuthReady() {
    authReady.value = false
  }

  return { user, authReady, isLoggedIn, isSuperAdmin, isPlatformStaff, isManager, canManageAll, canManageOwn, hasFeature, hasPreference, setUser, login, logout, setAuthReady, resetAuthReady }
})

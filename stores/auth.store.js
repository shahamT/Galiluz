export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const authReady = ref(false)
  const isLoggedIn = computed(() => !!user.value)
  /** Platform super-admin (full Galiluz management) — from the platform membership (`platformRole`). */
  const isSuperAdmin = computed(() => user.value?.platformRole === 'super_admin')
  /** Any platform staff (super_admin or read-only viewer) — may see the admin portal. */
  const isPlatformStaff = computed(() => !!user.value?.platformRole)
  /** Any authenticated user can act on their own resources. */
  const canManageOwn = computed(() => !!user.value)
  /**
   * Account-level feature entitlement check (UI gating only — the server
   * independently withholds gated data). The server sends a fully-resolved map
   * (defaults applied; super-admins get every feature), so this just reads booleans.
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

  return { user, authReady, isLoggedIn, isSuperAdmin, isPlatformStaff, canManageOwn, hasFeature, hasPreference, setUser, login, logout, setAuthReady, resetAuthReady }
})

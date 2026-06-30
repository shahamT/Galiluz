export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const authReady = ref(false)
  const isLoggedIn = computed(() => !!user.value)
  /** The single platform owner — may manage platform staff + the platform account's settings. */
  const isPlatformOwner = computed(() => user.value?.platformRole === 'platform_owner')
  /** Platform super-admin (full Galiluz management). The owner is a strict superset → true. */
  const isSuperAdmin = computed(() => user.value?.platformRole === 'super_admin' || user.value?.platformRole === 'platform_owner')
  /** Any platform staff (owner / super_admin / read-only viewer) — may see the admin portal. */
  const isPlatformStaff = computed(() => !!user.value?.platformRole)
  /** Any authenticated user can act on their own resources. */
  const canManageOwn = computed(() => !!user.value)
  /** Staff who haven't enrolled a passkey yet (auto-migrate grace) — client forces enrollment. */
  const mfaEnrollRequired = computed(() => user.value?.mfaEnrollRequired === true)
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

  return { user, authReady, isLoggedIn, isPlatformOwner, isSuperAdmin, isPlatformStaff, canManageOwn, mfaEnrollRequired, hasFeature, hasPreference, setUser, login, logout, setAuthReady, resetAuthReady }
})

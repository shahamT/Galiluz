const AUTH_KEY_STORAGE = 'galiluz_auth_key'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const isLoggedIn = computed(() => !!user.value)
  const isManager = computed(() => user.value?.type === 'manager')
  /** Manager can act on any resource. Use to show/hide manager-only UI. */
  const canManageAll = computed(() => user.value?.type === 'manager')
  /** Any authenticated user can act on their own resources. */
  const canManageOwn = computed(() => !!user.value)

  function setUser(userData) {
    user.value = userData
  }

  function login(token, userData) {
    if (import.meta.client) {
      localStorage.setItem(AUTH_KEY_STORAGE, token)
    }
    user.value = userData
  }

  function logout() {
    if (import.meta.client) {
      localStorage.removeItem(AUTH_KEY_STORAGE)
    }
    user.value = null
  }

  function getToken() {
    if (import.meta.client) {
      return localStorage.getItem(AUTH_KEY_STORAGE) || null
    }
    return null
  }

  return { user, isLoggedIn, isManager, canManageAll, canManageOwn, setUser, login, logout, getToken }
})

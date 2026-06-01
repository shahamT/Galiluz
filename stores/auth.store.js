export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const authReady = ref(false)
  const isLoggedIn = computed(() => !!user.value)
  const isManager = computed(() => user.value?.type === 'manager')
  /** Manager can act on any resource. Use to show/hide manager-only UI. */
  const canManageAll = computed(() => user.value?.type === 'manager')
  /** Any authenticated user can act on their own resources. */
  const canManageOwn = computed(() => !!user.value)

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

  return { user, authReady, isLoggedIn, isManager, canManageAll, canManageOwn, setUser, login, logout, setAuthReady, resetAuthReady }
})

export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore()
  const { checkAuth } = useAuth()

  const isProtected = to.path.startsWith('/publisher') || to.path.startsWith('/admin')
  const isLoginPage = to.path === '/login'

  // Only run on client (localStorage not available on server)
  if (import.meta.server) return

  const authenticated = authStore.isLoggedIn || await checkAuth()

  if (isProtected && !authenticated) {
    return navigateTo('/login')
  }

  if (isLoginPage && authenticated) {
    const dest = authStore.isManager ? '/admin' : '/publisher/dashboard'
    return navigateTo(dest)
  }
})

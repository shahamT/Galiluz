export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore()
  const { checkAuth } = useAuth()

  const isAdminRoute = to.path.startsWith('/admin')
  const isPublisherRoute = to.path.startsWith('/publisher')
  const isProtected = isAdminRoute || isPublisherRoute
  const isLoginPage = to.path === '/login'

  // Only run on client (localStorage not available on server)
  if (import.meta.server) return

  const authenticated = authStore.isLoggedIn || await checkAuth()

  if (isProtected && !authenticated) {
    return navigateTo('/login')
  }

  // Role check: only managers can access /admin
  if (isAdminRoute && authenticated && !authStore.isManager) {
    return navigateTo('/publisher/dashboard')
  }

  if (isLoginPage && authenticated) {
    const dest = authStore.isManager ? '/admin' : '/publisher/dashboard'
    return navigateTo(dest)
  }
})

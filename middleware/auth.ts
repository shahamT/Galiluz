export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore()
  const { checkAuth } = useAuth()

  const isAdminRoute = to.path.startsWith('/admin')
  const isPublisherRoute = to.path.startsWith('/publisher')
  const isProtected = isAdminRoute || isPublisherRoute
  const isLoginPage = to.path === '/login'

  // Only run on client (cookies and auth state are client-side)
  if (import.meta.server) return

  // Use cached state if available, otherwise verify with server (sends cookie automatically)
  const authenticated = authStore.isLoggedIn || await checkAuth()

  if (isProtected && !authenticated) {
    return navigateTo('/login')
  }

  // Role check: only managers can access /admin
  if (isAdminRoute && authenticated && !authStore.isManager) {
    return navigateTo('/publisher/dashboard')
  }

  if (isLoginPage && authenticated) {
    return navigateTo(authStore.isManager ? '/admin' : '/publisher/dashboard')
  }

  // Auth check passed — signal to protected pages that they can render
  if (isProtected && authenticated) {
    authStore.setAuthReady()
  }
})

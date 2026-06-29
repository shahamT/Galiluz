export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore()
  const { checkAuth } = useAuth()

  const isAdminRoute = to.path.startsWith('/admin')
  const isPublisherRoute = to.path.startsWith('/publisher')
  const isProtected = isAdminRoute || isPublisherRoute
  // Login + registration are entry pages: an already-authenticated user is bounced home.
  const isAuthEntryPage = to.path === '/login' || to.path === '/register'

  // Only run on client (cookies and auth state are client-side)
  if (import.meta.server) return

  // Reset auth-ready so the loader shows until this check resolves
  if (isProtected) authStore.resetAuthReady()

  // Use cached state if available, otherwise verify with server (sends cookie automatically)
  const authenticated = authStore.isLoggedIn || await checkAuth()

  if (isProtected && !authenticated) {
    return navigateTo('/login')
  }

  // Role check: any platform staff (owner / super_admin / read-only viewer) can access /admin.
  // Per-action gating (mutations) is enforced server-side + by hiding controls in the pages.
  if (isAdminRoute && authenticated && !authStore.isPlatformStaff) {
    return navigateTo('/publisher/dashboard')
  }

  // Sub-area gating (mutations are also server-enforced; this keeps a role out of pages it can't use).
  // Settings = platform governance: viewers have none; approvers config is owner-only.
  if (isAdminRoute && authenticated) {
    if (to.path.startsWith('/admin/settings') && !authStore.isSuperAdmin) return navigateTo('/admin/dashboard')
    if (to.path.startsWith('/admin/settings/approvers') && !authStore.isPlatformOwner) return navigateTo('/admin/dashboard')
  }

  if (isAuthEntryPage && authenticated) {
    return navigateTo(authStore.isPlatformStaff ? '/admin' : '/publisher/dashboard')
  }

  // Auth check passed — signal to protected pages that they can render
  if (isProtected && authenticated) {
    authStore.setAuthReady()
  }
})

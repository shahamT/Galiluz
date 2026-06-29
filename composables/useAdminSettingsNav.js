import { ADMIN_SETTINGS_NAV } from '~/consts/adminSettingsNav.js'

/**
 * The admin settings nav items visible to the current user, filtered by `minRole`:
 *  - 'owner' items → platform owner only
 *  - 'super_admin' items → super_admin or owner
 * Mirrors the route guards in middleware/auth.ts. Viewers see none (no settings page is viewer-usable).
 */
export function useAdminSettingsNav() {
  const authStore = useAuthStore()
  return computed(() =>
    ADMIN_SETTINGS_NAV.filter((item) =>
      item.minRole === 'owner' ? authStore.isPlatformOwner : authStore.isSuperAdmin,
    ),
  )
}

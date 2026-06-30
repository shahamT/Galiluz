import { ADMIN_SETTINGS_NAV } from '~/consts/adminSettingsNav.js'

/**
 * The admin settings nav items visible to the current user, filtered by `minRole`:
 *  - 'owner' items → platform owner only
 *  - 'super_admin' items → super_admin or owner
 *  - 'staff' items → any platform staff (incl. read-only viewer) — e.g. "my passkeys"
 * Mirrors the route guards in middleware/auth.ts.
 */
export function useAdminSettingsNav() {
  const authStore = useAuthStore()
  return computed(() =>
    ADMIN_SETTINGS_NAV.filter((item) =>
      item.minRole === 'owner'
        ? authStore.isPlatformOwner
        : item.minRole === 'staff'
          ? authStore.isPlatformStaff
          : authStore.isSuperAdmin,
    ),
  )
}

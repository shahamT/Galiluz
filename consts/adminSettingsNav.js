/**
 * Admin settings sub-pages. Drives both the desktop sidebar (SettingsLayout) and
 * the mobile drill-in list (pages/admin/settings/index.vue). Add new settings here.
 *
 * `minRole` gates visibility (and matches the route guards in middleware/auth.ts):
 *   'super_admin' → super_admin or owner;  'owner' → platform owner only.
 */
export const ADMIN_SETTINGS_NAV = [
  { to: '/admin/settings/otp', label: 'שיטת שליחת OTP — וואטסאפ / SMS', icon: 'sms', minRole: 'super_admin' },
  { to: '/admin/settings/crawler', label: 'קראולר וואטסאפ — טיוטות אוטומטיות', icon: 'smart_toy', minRole: 'super_admin' },
  { to: '/admin/settings/approvers', label: 'ניהול מאשרים', icon: 'verified_user', minRole: 'owner' },
  { to: '/admin/settings/broadcast-messages', label: 'שליחת הודעות למפרסמים', icon: 'send', minRole: 'super_admin' },
]

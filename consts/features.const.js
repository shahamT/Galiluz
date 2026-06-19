/**
 * Account-level feature registry (entitlements).
 *
 * Single source of truth for which features can be toggled per account. Flags
 * live on the `accounts` collection in a `features` object and are resolved
 * server-side by getAccountFeatures() (server/utils/accountFeatures.ts). A future
 * admin UI will edit these; for now they are set directly in the DB.
 *
 * `default` is the value used when an account has no explicit flag — currently
 * OFF (opt-in): a feature is unavailable until explicitly enabled on the account.
 */
export const ACCOUNT_FEATURES = [
  { key: 'globalStats',   label: 'סטטיסטיקות כלליות (דשבורד)', default: false },
  { key: 'perEventStats', label: 'סטטיסטיקות לכל אירוע',        default: false },
]

export const FEATURE_KEYS = ACCOUNT_FEATURES.map((f) => f.key)

export const FEATURE_DEFAULTS = Object.fromEntries(ACCOUNT_FEATURES.map((f) => [f.key, f.default]))

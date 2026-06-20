import { PREFERENCE_KEYS, PREFERENCE_DEFAULTS } from '~/consts/preferences.const.js'

export type PreferenceMap = Record<string, boolean>

/**
 * Resolve a publisher's preferences: stored values merged over the registry
 * defaults, whitelisted to known keys (a malformed/unexpected stored object can
 * never inject extra keys or values).
 *
 * Eligibility (status 'approved', non-ghost) is enforced by callers BEFORE
 * granting/persisting a preference — ghosts are never opted in. At /api/auth/me
 * the caller is already an approved session, so a plain merge is correct.
 */
export function getPublisherPreferences(
  input: { preferences?: Record<string, unknown> | null } | null | undefined,
): PreferenceMap {
  const stored = (input?.preferences || {}) as Record<string, unknown>
  return Object.fromEntries(
    PREFERENCE_KEYS.map((k) => [k, typeof stored[k] === 'boolean' ? (stored[k] as boolean) : PREFERENCE_DEFAULTS[k]]),
  ) as PreferenceMap
}

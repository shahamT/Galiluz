import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { FEATURE_KEYS, FEATURE_DEFAULTS } from '~/consts/features.const.js'

export type FeatureMap = Record<string, boolean>

const allEnabled = (): FeatureMap => Object.fromEntries(FEATURE_KEYS.map((k) => [k, true]))

/**
 * Merge a stored `features` object over the registry defaults — whitelisted to
 * the known keys, ignoring any unknown or non-boolean values. Pure (no DB);
 * exported for unit testing.
 */
export function resolveFeatures(stored: Record<string, unknown> | null | undefined): FeatureMap {
  const s = stored || {}
  return Object.fromEntries(
    FEATURE_KEYS.map((k) => [k, typeof s[k] === 'boolean' ? (s[k] as boolean) : FEATURE_DEFAULTS[k]]),
  ) as FeatureMap
}

/**
 * Resolve the set of enabled features for the caller — the single authority for
 * account-level entitlements. Callers pass the session (which carries `accountId`
 * and `type`), e.g. `getAccountFeatures(session)`.
 *
 * - Managers (staff) bypass gating: every feature enabled.
 * - Result is whitelisted to the registry keys, so a malformed/unexpected
 *   `features` object in the DB can never inject behaviour or extra keys.
 * - Fail-closed: a missing accountId, bad id, or absent account doc resolves to
 *   the registry defaults (currently all OFF).
 */
export async function getAccountFeatures(input: { accountId?: string; type?: string }): Promise<FeatureMap> {
  if (input.type === 'manager') return allEnabled()
  if (!input.accountId) return { ...FEATURE_DEFAULTS }

  let oid: ObjectId
  try { oid = new ObjectId(input.accountId) } catch { return { ...FEATURE_DEFAULTS } }

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const accounts = db.collection(config.mongodbCollectionAccounts || 'accounts')
  const doc = await accounts.findOne({ _id: oid }, { projection: { features: 1 } })

  return resolveFeatures(doc?.features as Record<string, unknown> | undefined)
}

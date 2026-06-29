import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { getAppSetting } from '~/server/utils/appSettings'

/**
 * Approvers (the people who receive publisher-registration / new-event WhatsApp notices and act on
 * them). Configured from the admin portal — a list of `publisherId`s stored in the `appSettings`
 * doc `key:'approvers'` — and resolved here to `{ waId, name }` for the wa-bot. When the list is
 * empty, no one is notified (the admin must keep at least one approver).
 */
export interface Approver { publisherId: string; waId: string; name: string; isActive?: boolean }

const normWa = (v: unknown): string => String(v ?? '').replace(/\D/g, '')

/**
 * Resolve the configured approvers (approved publishers with a phone). Empty when none configured.
 * By default returns only ACTIVE, non-deleted approvers — these are the ones who receive notices and may
 * authorize actions (a deactivated/deleted approver must not). The admin LIST passes `{ includeInactive }`
 * so a deactivated approver stays visible (with `isActive:false`); deleted approvers are never returned.
 */
export async function getApprovers(opts: { includeInactive?: boolean } = {}): Promise<Approver[]> {
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const publishers = db.collection(config.mongodbCollectionPublishers || 'publishers')

  const doc = await getAppSetting('approvers')
  const ids = Array.isArray(doc?.publisherIds)
    ? ((doc!.publisherIds as unknown[]).filter((x) => typeof x === 'string') as string[])
    : []
  if (!ids.length) return []

  const objectIds = ids
    .map((id) => { try { return new ObjectId(id) } catch { return null } })
    .filter((x): x is ObjectId => x !== null)
  const filter: Record<string, unknown> = { _id: { $in: objectIds }, status: 'approved', deletedAt: { $exists: false } }
  if (!opts.includeInactive) filter.isActive = { $ne: false }
  const rows = await publishers
    .find(filter, { projection: { _id: 1, waId: 1, fullName: 1, isActive: 1 } })
    .toArray()
  return rows
    .map((p) => ({ publisherId: p._id.toString(), waId: normWa(p.waId), name: String(p.fullName || '') || normWa(p.waId), isActive: p.isActive !== false }))
    .filter((a) => a.waId)
}

/** Resolve a single approver by their waId (for recording who acted). Null if not a current approver. */
export async function getApproverByWaId(waId: string): Promise<Approver | null> {
  const target = normWa(waId)
  if (!target) return null
  const list = await getApprovers()
  return list.find((a) => a.waId === target) || null
}

/** The display name to record for an actor waId — the approver's name, or a generic fallback. */
export async function resolveActorName(waId: string): Promise<string> {
  return (await getApproverByWaId(waId))?.name || 'מאשר'
}

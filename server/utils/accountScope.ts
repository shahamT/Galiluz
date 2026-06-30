import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
import { deriveActiveRoles, type ResolvedRoles } from '~/server/utils/authz'
import { NOT_DELETED } from '~/server/utils/eventsQuery'
import type { PublisherSession } from '~/server/utils/requirePublisherAuth'

/**
 * Accounts layer: each account groups one or more publishers (each publisher
 * belongs to exactly one account). Today the mapping is 1:1, so account-scoped
 * queries return the same results as the old per-publisher scoping — the account
 * layer is structural groundwork for a future multi-publisher-per-business shift.
 *
 * Scoping is resolved at query time (account → its publisherIds) rather than
 * denormalizing accountId onto events/stats. Callers replace a `publisherId: X`
 * filter with `publisherId: { $in: await getAccountPublisherIds(session) }`.
 */

interface PublisherDoc {
  _id: { toString(): string }
  accountId?: string
  accountName?: string
  publishingAs?: string // legacy carrier — removed by migrate-publishingas-to-account.js
  waId?: string
}

/**
 * Ensure the publisher has an account; returns its accountId.
 * Idempotent: if the publisher already has `accountId`, it is returned unchanged.
 * Otherwise a new account is created (title = the publisher's `accountName`) and
 * stamped onto the publisher. `publishingAs` is a transitional fallback for any
 * bot-pending doc not yet touched by the migration; `waId` is the last resort.
 */
export async function ensureAccountForPublisher(publisherDoc: PublisherDoc): Promise<string> {
  // Idempotent: already has an account → return it unchanged (no DB write here).
  // Existing publishers get their owner membership from the one-time backfill; brand-new
  // ones get it in the create branch below.
  if (publisherDoc?.accountId) return publisherDoc.accountId

  const publisherId = publisherDoc._id.toString()

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const accounts = db.collection(config.mongodbCollectionAccounts || 'accounts')
  const publishers = db.collection(config.mongodbCollectionPublishers || 'publishers')

  // deletedAt is intentionally omitted (absent until soft-delete) so the
  // date-typed accounts validator accepts the insert.
  const { insertedId } = await accounts.insertOne({
    title: publisherDoc.accountName || publisherDoc.publishingAs || publisherDoc.waId || 'Account',
    kind: 'business',
    isActive: true,
    createdAt: new Date(),
  })
  const accountId = insertedId.toString()

  // Keep publishers.accountId as the denormalized default-active-business-account pointer,
  // and record the authoritative owner membership (publisher↔account↔role).
  await publishers.updateOne({ _id: publisherDoc._id }, { $set: { accountId } })
  await ensureMembership(publisherId, accountId, 'owner')
  return accountId
}

let _platformAccountIdMemo: string | null = null

/**
 * The single Galiluz-management ("platform") account id. Find-or-create, memoized per process.
 * Staff hold platform-role memberships (super_admin/viewer) in THIS account; it owns no events.
 */
export async function getPlatformAccountId(): Promise<string> {
  if (_platformAccountIdMemo) return _platformAccountIdMemo
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const accounts = db.collection(config.mongodbCollectionAccounts || 'accounts')

  const existing = await accounts.findOne({ kind: 'platform' }, { projection: { _id: 1 } })
  if (existing) {
    const id = existing._id.toString()
    _platformAccountIdMemo = id
    return id
  }
  const { insertedId } = await accounts.insertOne({
    title: 'Galiluz Management',
    kind: 'platform',
    isActive: true,
    createdAt: new Date(),
  })
  const id = insertedId.toString()
  _platformAccountIdMemo = id
  return id
}

/**
 * Idempotently grant a publisher a role in an account (the authoritative publisher↔account↔role
 * row). Upsert on the unique {publisherId, accountId}; an existing membership is left UNCHANGED
 * (never downgrades/overwrites a role). The unique index makes concurrent inserts race-safe.
 */
export async function ensureMembership(publisherId: string, accountId: string, role: string): Promise<void> {
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const memberships = db.collection(config.mongodbCollectionMemberships || 'memberships')
  try {
    await memberships.updateOne(
      { publisherId, accountId },
      { $setOnInsert: { publisherId, accountId, role, status: 'active', createdAt: new Date() } },
      { upsert: true },
    )
  } catch (err) {
    if ((err as { code?: number })?.code !== 11000) throw err
    // Concurrent insert of the same pair raced us — the row exists, which is the goal.
  }
}

/**
 * Resolve a publisher's display "account title": the linked account's `title` when
 * an `accountId` exists, else the pending-period `accountName`, else the waId. This
 * is the single source for the API/session `publishingAs` field after the account-name
 * relocation (publishers no longer store `publishingAs`).
 */
export async function resolveAccountTitle(input: { accountId?: string | null; accountName?: string | null; waId?: string | null }): Promise<string> {
  const { accountId, accountName, waId } = input
  if (accountId) {
    try {
      const config = useRuntimeConfig() as Record<string, string>
      const { db } = await getMongoConnection()
      const accounts = db.collection(config.mongodbCollectionAccounts || 'accounts')
      const acc = await accounts.findOne({ _id: new ObjectId(accountId) }, { projection: { title: 1 } })
      if (acc?.title) return String(acc.title)
    } catch {
      // invalid ObjectId / lookup failure → fall through to the carrier/waId
    }
  }
  return accountName || waId || ''
}

/**
 * Resolve a publisher's effective roles + active account by reading their `memberships`
 * (the source of truth) and deriving via the pure `deriveActiveRoles` policy. Used by both
 * `requirePublisherAuth` (session build) and `verify-otp` (login response) so the derivation
 * lives in ONE place. Roles are never cached on the publisher — a stale role cache is the
 * classic multi-tenant escalation bug.
 */
export async function resolvePublisherRoles(input: { publisherId: string; accountId?: string | null }): Promise<ResolvedRoles> {
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const memberships = db.collection(config.mongodbCollectionMemberships || 'memberships')
  const rows = await memberships
    .find({ publisherId: input.publisherId, status: 'active' }, { projection: { accountId: 1, role: 1, createdAt: 1 } })
    .toArray()
  return deriveActiveRoles(
    rows.map((r) => ({ accountId: String(r.accountId), role: String(r.role), createdAt: r.createdAt })),
    input.accountId || undefined,
  )
}

/**
 * Resolve the set of publisherIds belonging to the session's ACTIVE account, read from
 * `memberships` (members of `activeAccountId`). Stats rows are keyed by `publisherId`, so this
 * publisher-set is how dashboard/stats scope (event reads use the `event.accountId` tenant key
 * instead). A platform-only staffer with no business account → `[publisherId]` (their own).
 */
export async function getAccountPublisherIds(session: PublisherSession): Promise<string[]> {
  const accountId = session.activeAccountId
  if (!accountId) return [session.publisherId]

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const memberships = db.collection(config.mongodbCollectionMemberships || 'memberships')

  const rows = await memberships
    .find({ accountId, status: 'active' }, { projection: { publisherId: 1 } })
    .toArray()

  return rows.map((r) => String(r.publisherId)).filter(Boolean)
}

/**
 * A publisher's BUSINESS accounts (owner/admin memberships) joined with the account's display
 * info — for the login account-picker (shown only when there are 2+) and a future account switcher.
 * Excludes the platform account and soft-deleted accounts. Sorted owner-first, then by title.
 */
export async function getPublisherBusinessAccounts(
  publisherId: string,
): Promise<Array<{ accountId: string; title: string; logo: string | null; role: string }>> {
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const memberships = db.collection(config.mongodbCollectionMemberships || 'memberships')
  const accountsCol = db.collection(config.mongodbCollectionAccounts || 'accounts')

  const rows = await memberships
    .find({ publisherId, status: 'active', role: { $in: ['owner', 'admin'] } }, { projection: { accountId: 1, role: 1 } })
    .toArray()
  if (!rows.length) return []

  const ids = rows
    .map((r) => { try { return new ObjectId(String(r.accountId)) } catch { return null } })
    .filter((v): v is ObjectId => v !== null)
  const accs = await accountsCol
    .find({ _id: { $in: ids }, kind: { $ne: 'platform' }, ...NOT_DELETED }, { projection: { title: 1, logo: 1 } })
    .toArray()
  const byId = new Map(accs.map((a) => [a._id.toString(), a]))

  const result = rows
    .map((r) => {
      const acc = byId.get(String(r.accountId))
      if (!acc) return null
      return { accountId: String(r.accountId), title: String(acc.title || ''), logo: (acc.logo as string) || null, role: String(r.role) }
    })
    .filter((v): v is { accountId: string; title: string; logo: string | null; role: string } => v !== null)

  const priority: Record<string, number> = { owner: 0, admin: 1 }
  result.sort((a, b) => (priority[a.role] ?? 9) - (priority[b.role] ?? 9) || a.title.localeCompare(b.title, 'he'))
  return result
}

/**
 * Portal "my events" filter: events owned by the session's ACTIVE account (the `event.accountId`
 * tenant key). A platform-only staffer with no active account → a filter that matches nothing.
 * Super-admins bypass scoping at the call site (they see every account's events via /admin).
 */
export function getAccountEventFilter(session: PublisherSession): Record<string, unknown> {
  return { 'event.accountId': session.activeAccountId || { $in: [] } }
}

/**
 * Does the session's active account OWN this event? Compares the `event.accountId` tenant key.
 * Super-admins bypass ownership at the call site (they may act on any event).
 */
export function ownsEventForSession(session: PublisherSession, eventObj: { accountId?: string } | null | undefined): boolean {
  return !!eventObj?.accountId && eventObj.accountId === session.activeAccountId
}

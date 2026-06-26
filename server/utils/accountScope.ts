import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'
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
 * Resolve the set of publisherIds belonging to the session's account.
 * Falls back to `[session.publisherId]` when the publisher has no account yet
 * (pre-backfill) — so scoping degrades gracefully to the old per-publisher
 * behaviour and never widens or empties a query unexpectedly.
 */
export async function getAccountPublisherIds(session: PublisherSession): Promise<string[]> {
  if (!session.accountId) return [session.publisherId]

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const publishers = db.collection(config.mongodbCollectionPublishers || 'publishers')

  const docs = await publishers
    .find({ accountId: session.accountId }, { projection: { _id: 1 } })
    .toArray()

  const ids = docs.map((d) => d._id.toString())
  // Defensive: an account should always contain at least its own publisher.
  return ids.length ? ids : [session.publisherId]
}

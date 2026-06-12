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
  publishingAs?: string
  waId?: string
}

/**
 * Ensure the publisher has an account; returns its accountId.
 * Idempotent: if the publisher already has `accountId`, it is returned unchanged.
 * Otherwise a new account is created (title = publishingAs, falling back to waId)
 * and stamped onto the publisher.
 */
export async function ensureAccountForPublisher(publisherDoc: PublisherDoc): Promise<string> {
  if (publisherDoc?.accountId) return publisherDoc.accountId

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const accounts = db.collection(config.mongodbCollectionAccounts || 'accounts')
  const publishers = db.collection(config.mongodbCollectionPublishers || 'publishers')

  // deletedAt is intentionally omitted (absent until soft-delete) so the
  // date-typed accounts validator accepts the insert.
  const { insertedId } = await accounts.insertOne({
    title: publisherDoc.publishingAs || publisherDoc.waId || 'Account',
    isActive: true,
    createdAt: new Date(),
  })
  const accountId = insertedId.toString()

  await publishers.updateOne({ _id: publisherDoc._id }, { $set: { accountId } })
  return accountId
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

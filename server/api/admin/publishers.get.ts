import { getMongoConnection } from '~/server/utils/mongodb'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { NOT_DELETED } from '~/server/utils/eventsQuery'

/**
 * Admin (manager-only) filter options: every account and every publisher on the
 * platform, for the events-list "filter by account / publisher" control.
 * Publishers carry their account name so the dropdown can chip it without a join.
 */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requireManager: true })

  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()

  const accountsCol = db.collection(config.mongodbCollectionAccounts || 'accounts')
  const publishersCol = db.collection(config.mongodbCollectionPublishers || 'publishers')

  const [accountDocs, publisherDocs] = await Promise.all([
    accountsCol.find(NOT_DELETED, { projection: { _id: 1, title: 1 } }).toArray(),
    publishersCol
      .find(NOT_DELETED, { projection: { _id: 1, waId: 1, accountId: 1, accountName: 1, fullName: 1, status: 1 } })
      .toArray(),
  ])

  const accountNameById = new Map<string, string>()
  accountDocs.forEach((a) => accountNameById.set(a._id.toString(), a.title || ''))

  const collator = new Intl.Collator('he')

  const accounts = accountDocs
    .map((a) => ({ id: a._id.toString(), name: a.title || '' }))
    .sort((x, y) => collator.compare(x.name, y.name))

  const publishers = publisherDocs
    .map((p) => {
      // Account title: the linked account (approved) or the pending-period carrier.
      const accountName = p.accountId ? (accountNameById.get(p.accountId) || '') : (p.accountName || '')
      return {
        id: p._id.toString(),
        name: p.fullName || accountName || p.waId || '',
        phone: p.waId || '',
        accountId: p.accountId || '',
        accountName,
        status: p.status || '',
      }
    })
    .sort((x, y) => collator.compare(x.name, y.name))

  return { accounts, publishers }
})

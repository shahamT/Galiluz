import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { getPublisherBusinessAccounts } from '~/server/utils/accountScope'

/**
 * The caller's BUSINESS accounts (owner/admin), with title + logo + role — for the login
 * account-picker (shown only when there are 2+) and a future in-portal account switcher.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePublisherAuth(event)
  return getPublisherBusinessAccounts(session.publisherId)
})

import { requireApiSecret } from '~/server/utils/requireApiSecret'
import { getApprovers } from '~/server/utils/approvers'

/**
 * Internal (ApiSecret): the resolved approver list for the wa-bot to fan out notifications to and to
 * authorize incoming approver actions. Returns `{ approvers: [{ waId, name }] }` (publisherId omitted
 * — the bot only needs to message + name them).
 */
export default defineEventHandler(async (event) => {
  requireApiSecret(event)
  const approvers = await getApprovers()
  return { approvers: approvers.map((a) => ({ waId: a.waId, name: a.name })) }
})

/**
 * In-memory conversation state per user (wa_id).
 * Keys: step (welcome | discover_* | publish_*), categoryGroupId?, timeChoice?,
 *       fullName?, publishingAs?, eventTypesDescription?, profileName? (for publish flow).
 */

const stateByUser = new Map()

const STEPS = {
  WELCOME: 'welcome',
  DISCOVER_CATEGORY: 'discover_category',
  DISCOVER_TIME: 'discover_time',
  DISCOVER_AFTER_LIST: 'discover_after_list',
  PUBLISH_ASK_FULL_NAME: 'publish_ask_full_name',
  PUBLISH_ASK_PUBLISHING_AS: 'publish_ask_publishing_as',
  PUBLISH_ASK_EVENT_TYPES: 'publish_ask_event_types',
  PUBLISH_ASK_COMMITMENT: 'publish_ask_commitment',
  APPROVER_WAITING_REASON: 'approver_waiting_reason',
}

function get(waId) {
  return stateByUser.get(waId) || { step: STEPS.WELCOME }
}

function set(waId, data) {
  const current = get(waId)
  stateByUser.set(waId, { ...current, ...data })
}

function clear(waId) {
  stateByUser.delete(waId)
}

export const conversationState = {
  STEPS,
  get,
  set,
  clear,
}

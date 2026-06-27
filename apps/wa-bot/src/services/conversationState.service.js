/**
 * In-memory conversation state per user (wa_id). The bot has two interactive flows:
 *   - DISCOVER (browse events): step discover_* + categoryGroupId, discoverRegion, timeChoice,
 *     discoverSearchedTimesByCategory.
 *   - APPROVER (approve/reject publisher, delete event): step approver_waiting_* + publisherWaId,
 *     approverDeleteEventId, approverDeletePublisherPhone, approverDeleteEventTitle.
 * Plus `welcomeShown` (whether the full welcome menu was shown, to choose welcome vs
 * INTENT_UNCLEAR/IRRELEVANT on free-text). The publisher add/edit/delete/register flows were
 * retired — publishers are sent to the web portal — so those steps no longer exist.
 *
 * State is in-memory only and is lost on process restart or deploy. Users mid-flow see the
 * welcome menu on their next message after a restart.
 */

const stateByUser = new Map()

const STEPS = {
  WELCOME: 'welcome',
  DISCOVER_CATEGORY: 'discover_category',
  DISCOVER_REGION: 'discover_region',
  DISCOVER_TIME: 'discover_time',
  DISCOVER_AFTER_LIST: 'discover_after_list',
  APPROVER_WAITING_REASON: 'approver_waiting_reason',
  APPROVER_WAITING_DELETE_REASON: 'approver_waiting_delete_reason',
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

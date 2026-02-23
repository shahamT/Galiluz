/**
 * In-memory conversation state per user (wa_id).
 * Keys: step (welcome | discover_* | publish_* | event_add_*), categoryGroupId?, timeChoice?,
 *       fullName?, publishingAs?, eventTypesDescription?, profileName? (for publish flow).
 *       eventAdd* (for event-add flow): eventAddTitle, eventAddDateTime, eventAddMainCategoryGroupId?,
 *       eventAddMainCategory, eventAddExtraCategories[] (no longer collected in flow; kept for API, always []),
 *       eventAddPlaceName, eventAddCity, eventAddAddressLine1,
 *       eventAddAddressLine2, eventAddLocationNotes, eventAddWazeLink, eventAddGmapsLink,
 *       eventAddPrice, eventAddDescription, eventAddLinks, eventAddMedia[], eventAddLastActivityAt (ms).
 *
 * State is in-memory only and is lost on process restart or deploy. Users in the middle of a flow
 * will see the welcome menu on their next message after a restart.
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
  EVENT_ADD_INITIAL: 'event_add_initial',
  EVENT_ADD_TITLE: 'event_add_title',
  EVENT_ADD_DATETIME: 'event_add_datetime',
  EVENT_ADD_MAIN_CATEGORY_GROUP: 'event_add_main_category_group',
  EVENT_ADD_MAIN_CATEGORY: 'event_add_main_category',
  EVENT_ADD_EXTRA_CATEGORIES: 'event_add_extra_categories',
  EVENT_ADD_LOCATION_INTRO: 'event_add_location_intro',
  EVENT_ADD_PLACE_NAME: 'event_add_place_name',
  EVENT_ADD_CITY: 'event_add_city',
  EVENT_ADD_ADDRESS: 'event_add_address',
  EVENT_ADD_LOCATION_NOTES: 'event_add_location_notes',
  EVENT_ADD_WAZE_GMAPS: 'event_add_waze_gmaps',
  EVENT_ADD_PRICE: 'event_add_price',
  EVENT_ADD_DESCRIPTION: 'event_add_description',
  EVENT_ADD_LINKS: 'event_add_links',
  EVENT_ADD_MEDIA: 'event_add_media',
  EVENT_ADD_MEDIA_MORE: 'event_add_media_more',
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

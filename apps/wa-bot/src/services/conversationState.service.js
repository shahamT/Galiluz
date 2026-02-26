/**
 * In-memory conversation state per user (wa_id).
 * Keys: step (welcome | discover_* | publish_* | event_add_*), categoryGroupId?, timeChoice?,
 *       fullName?, publishingAs?, eventTypesDescription?, profileName? (for publish flow).
 *       eventAdd* (for event-add flow): eventAddTitle, eventAddDateTime, eventAddMainCategoryGroupId?,
 *       eventAddMainCategory, eventAddExtraCategories[] (no longer collected in flow; kept for API, always []),
 *       eventAddPlaceName, eventAddCity, eventAddCityResult: { type: 'listed', value: { cityId, cityTitle, region } } | { type: 'custom', value: string },
 *       eventAddRegion (region key: center | golan | upper),
 *       eventAddAddressLine1,
 *       eventAddAddressLine2, eventAddLocationNotes, eventAddNavLinks,
 *       eventAddPrice, eventAddDescription, eventAddLinks, eventAddMedia[], eventAddLastActivityAt (ms).
 *       eventAddFormattedPreview (temporary: formatted event from process API for confirm step).
 *       eventAddDraftId (draft record id in MongoDB; set after createDraft, used for process and activate).
 *       eventAddConfirmPending (temporary: true while handling max media, to avoid duplicate "נשמרו 6 קבצים" and multiple goToConfirm calls).
 *       eventAddFlags (array of { fieldKey, reason } from last processResult when AI raised flags).
 *       eventAddFlagFieldOrder (array of field keys to re-ask, deduplicated, canonical order).
 *       eventAddFlagIndex (index into eventAddFlagFieldOrder for current field being collected).
 *       eventAddEditMenu / eventAddEditField / eventAddEditMainCategoryGroup / eventAddEditMainCategory (edit-details flow).
 *       eventAddFlagRegionPending (when rawCity skipped in flag flow: collect region before next flag).
 *       eventAddFreeLangEdits, eventAddFreeLangPendingCity (free-lang city edit: collect region when custom city before confirm).
 *       eventEditFieldKey (when step is event_add_edit_field: 'title' | 'description' | 'mainCategory' | ...).
 *       eventUpdateMode (true when edit flow was entered from "עדכון אירוע" — on done show update-success + link instead of activate).
 *       eventUpdateList, eventUpdateListOffset (events list and pagination for update flow).
 *       eventDeleteList, eventDeleteListOffset (events list and pagination for delete flow).
 *       eventDeleteSelectedId (event id selected for deletion, set before EVENT_DELETE_CONFIRM).
 *
 *       welcomeShown (boolean): set after the welcome message is sent at the WELCOME step, so only
 *         subsequent text messages trigger free-language intent processing; first text shows welcome.
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
  PUBLISHER_CHOOSE_ACTION: 'publisher_choose_action',
  EVENT_UPDATE_SELECT_EVENT: 'event_update_select_event',
  EVENT_DELETE_SELECT_EVENT: 'event_delete_select_event',
  EVENT_DELETE_CONFIRM: 'event_delete_confirm',
  EVENT_ADD_INITIAL: 'event_add_initial',
  EVENT_ADD_TITLE: 'event_add_title',
  EVENT_ADD_DATETIME: 'event_add_datetime',
  EVENT_ADD_MAIN_CATEGORY_GROUP: 'event_add_main_category_group',
  EVENT_ADD_MAIN_CATEGORY: 'event_add_main_category',
  EVENT_ADD_EXTRA_CATEGORIES: 'event_add_extra_categories',
  EVENT_ADD_LOCATION_INTRO: 'event_add_location_intro',
  EVENT_ADD_PLACE_NAME: 'event_add_place_name',
  EVENT_ADD_CITY: 'event_add_city',
  EVENT_ADD_REGION: 'event_add_region',
  EVENT_ADD_ADDRESS: 'event_add_address',
  EVENT_ADD_LOCATION_NOTES: 'event_add_location_notes',
  EVENT_ADD_WAZE_GMAPS: 'event_add_waze_gmaps',
  EVENT_ADD_PRICE: 'event_add_price',
  EVENT_ADD_DESCRIPTION: 'event_add_description',
  EVENT_ADD_LINKS: 'event_add_links',
  EVENT_ADD_MEDIA: 'event_add_media',
  EVENT_ADD_MEDIA_MORE: 'event_add_media_more',
  EVENT_ADD_FLAGS_REVIEW: 'event_add_flags_review',
  EVENT_ADD_FLAG_INPUT: 'event_add_flag_input',
  EVENT_ADD_CONFIRM: 'event_add_confirm',
  EVENT_ADD_EDIT_MENU: 'event_add_edit_menu',
  EVENT_ADD_EDIT_FIELD: 'event_add_edit_field',
  EVENT_ADD_EDIT_MAIN_CATEGORY_GROUP: 'event_add_edit_main_category_group',
  EVENT_ADD_EDIT_MAIN_CATEGORY: 'event_add_edit_main_category',
  EVENT_ADD_EDIT_SUCCESS: 'event_add_edit_success',
  EVENT_ADD_EDIT_EXTRA_CATEGORIES: 'event_add_edit_extra_categories',
  EVENT_ADD_EDIT_EXTRA_ADD_GROUP: 'event_add_edit_extra_add_group',
  EVENT_ADD_EDIT_EXTRA_ADD_CATEGORY: 'event_add_edit_extra_add_category',
  EVENT_ADD_EDIT_EXTRA_REMOVE: 'event_add_edit_extra_remove',
  EVENT_ADD_EDIT_LOCATION_MENU: 'event_add_edit_location_menu',
  EVENT_ADD_EDIT_LOCATION_FIELD: 'event_add_edit_location_field',
  EVENT_ADD_EDIT_REGION: 'event_add_edit_region',
  EVENT_ADD_EDIT_FREE_LANG_REGION: 'event_add_edit_freelang_region',
  EVENT_ADD_EDIT_MEDIA_INTRO: 'event_add_edit_media_intro',
  EVENT_ADD_EDIT_FREE_LANG_CONFIRM: 'event_add_edit_freelang_confirm',
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

/**
 * Log prefixes for wa-bot services
 */
export const LOG_PREFIXES = {
  MAIN: '[Main]',
  CONFIG: '[Config]',
  WEBHOOK: '[Webhook]',
  CLOUD_API: '[CloudAPI]',
  EVENT_ADD: '[EventAdd]',
  SHUTDOWN: '[Shutdown]',
  FATAL: '[Fatal]',
}

/**
 * WhatsApp Cloud API version
 */
export const API_VERSION = 'v22.0'

/** Webhook message batching: idle ms before flushing pending messages into processing queue. */
export const BATCH_FLUSH_MS = 250

/**
 * Welcome message: reply buttons (quick replies, max 3, title max 20 chars).
 */
export const WELCOME_INTERACTIVE = {
  body: 'היי! 👋\nאני הבוט של אפליקציית *גלילו"ז* - Galiluz\n\nכנסו לאפליקציה כדי לגלות כל מה שקורה בצפון\n*גלילו"ז*🏔️ - https://galiluz.co.il\n\n*איך אפשר לעזור לכם?* 😊',
  buttons: [
    { id: 'discover', title: '?מה קורה בצפון 🏔️' },
    { id: 'publish', title: 'פרסום/עדכון אירוע 📅' },
    { id: 'contact', title: 'צרו קשר 📩' },
  ],
}

/** Contact: message with wa.me link so user can open chat with the number */
export const CONTACT_MESSAGE =
  'לצורך יצירת קשר ניתן לשלוח הודעה ישירות:\nhttps://wa.me/972559896278'

/** Main menu: when user request is not something we offer. Body + main menu buttons. */
export const MAIN_MENU_INTENT_IRRELEVANT = {
  body: 'אין לנו איך לעזור לכם עם הבקשה הזו בשלב זה.\nאם תרצו, אפשר:',
  buttons: WELCOME_INTERACTIVE.buttons,
}

/** Main menu: when we could not understand what the user wants. Body + main menu buttons. */
export const MAIN_MENU_INTENT_UNCLEAR = {
  body: 'לא הצלחנו להבין מה תרצו לעשות,\nמוזמנים לכתוב שוב, או:',
  buttons: WELCOME_INTERACTIVE.buttons,
}

/** Shown when non-publisher tries update/delete via free language. */
export const MAIN_MENU_PUBLISHER_ONLY =
  'רק מפרסמים מאושרים יכולים לעדכן או למחוק אירועים.'

/** Discover flow: ask category (list body) */
export const DISCOVER_ASK_CATEGORY = 'איזה אירועים את/ה מחפש/ת?'

/** Discover flow: ask time (body + footer + button ids) */
export const DISCOVER_ASK_TIME = {
  body: 'מתי?',
  footer: 'לצפייה בכל האירועים כנסו ל־galiluz.co.il',
  buttons: [
    { id: 'today', title: 'היום' },
    { id: 'tomorrow', title: 'מחר' },
  ],
}

/** Discover flow: after sending events list — body + footer + 3 buttons */
export const DISCOVER_AFTER_LIST = {
  body: 'לא מצאת מה שחיפשת?',
  footer: 'לצפייה בכל האירועים כנסו ל־galiluz.co.il',
  buttons: [
    { id: 'discover', title: 'חפשו שוב' },
    { id: 'today', title: 'היום' },
    { id: 'tomorrow', title: 'מחר' },
  ],
}

/** Publish flow: placeholder when approved */
export const PUBLISH_REPLY = '*פרסום אירוע יגיע בקרוב!* עד אז אפשר להיכנס ל־https://galiluz.co.il'

/** Publish flow: not registered — body + sign up / back to menu */
export const PUBLISH_NOT_REGISTERED = {
  body: '*פעם ראשונה?* 🤩\nבואו נעבור אימות קצרצר (זה לוקח דקה)\n\n _חשוב לנו לוודא שרק מפרסמים מאומתים מעלים אירועים אמיתיים ולגיטימיים למערכת_ ',
  buttons: [
    { id: 'publish_sign_me_up', title: 'בואו נתחיל' },
    { id: 'back_to_main', title: 'בחזרה לתפריט הראשי' },
  ],
}

/** Publish flow: registration steps (text prompts) */
export const PUBLISH_ASK_FULL_NAME = 'מה השם המלא שלך?'
export const PUBLISH_ASK_PUBLISHING_AS =
  'מטעם מי אתם מפרסמים?\n_יוזמה פרטית / שם העסק_'
export const PUBLISH_ASK_EVENT_TYPES =
  'אילו אירועים אתם מתכוונים לפרסם בגלילו"ז?\n(תיאור כללי)\n_לדוגמה - מסיבה בפאב השכונתי_'

/** Publish flow: commitment step — body + buttons */
export const PUBLISH_ASK_COMMITMENT = {
  body: '_אני מתחייב/ת_ לפרסם אירועים בצפון בלבד ולציין פרטים מלאים ומהימנים של כל אירוע שאפרסם.',
  buttons: [
    { id: 'publish_commit_yes', title: 'מתחייב/ת' },
    { id: 'back_to_main', title: 'בחזרה לתפריט הראשי' },
  ],
}

/** Publish flow: thank you after registration */
export const PUBLISH_THANK_YOU = {
  body: '*זהו! סיימנו* 🤩\nאנחנו נבדוק את הפרטים ששלחת וברגע שנאשר - *תקבל/י מאיתנו הודעה* ותוכל/י להתחיל לפרסם אירועים!',
  buttons: [{ id: 'back_to_main', title: 'בחזרה לתפריט הראשי' }],
}

/** Publish flow: user is pending approval */
export const PUBLISH_PENDING_MESSAGE =
  'אנחנו בודקים את הפרטים שהעברת. *תקבל/י מאיתנו הודעת וואטסאפ* ברגע שאושרת. עד אז אפשר להיכנס לאתר גלילו"ז.'

/** Publish flow: registration API failed */
export const PUBLISH_REGISTER_ERROR = 'משהו השתבש. נסה שוב מאוחר יותר.'

/** Publish flow: when user must reply with text (e.g. during registration steps) */
export const PUBLISH_EXPECT_TEXT = 'נא להשיב בטקסט.'

// --- Publisher approver flow (button titles max 20 chars) ---

/** Approver: body template for new publisher request. Use: name, publishingAs, eventTypes, waId */
export const APPROVER_REQUEST_BODY_TEMPLATE =
  '*בקשת הרשמה כמפרסם/ת:*\n*שם מלא:* {fullName}\n*מטעם:* {publishingAs}\n*סוג אירועים:* {eventTypes}\n*מזהה וואטסאפ:* {waId}'

/** Approver: button ids are approve_<waId>, reject_<waId>, reject_no_reason_<waId> */
export const APPROVER_BUTTONS = {
  approve: { idPrefix: 'approve_', title: 'לאשר מפרסם ✅' },
  reject: { idPrefix: 'reject_', title: 'לא לאשר מפרסם ❌' },
  rejectNoReason: { idPrefix: 'reject_no_reason_', title: 'דחה ללא סיבה' },
}

/** Approver: ask reason for rejection */
export const APPROVER_ASK_REASON = {
  body: 'מה סיבת הדחייה?',
  noReasonButton: { idPrefix: 'no_reason_', title: 'ללא סיבה' },
}

/** To publisher: approved — body + two buttons */
export const PUBLISHER_APPROVED = {
  body: '*את/ה מאושר/ת!* (תרתי משמע 😉)\nמעכשיו את/ה יכול/ה לפרסם אירועים בגלילו"ז',
  buttons: [
    { id: 'publish', title: 'לפרסום אירוע' },
    { id: 'back_to_main', title: 'בחזרה לתפריט הראשי' },
  ],
}

/** After publisher is confirmed: "How do you want to continue?" with 3 actions. */
export const PUBLISHER_HOW_TO_CONTINUE = {
  body: 'איך תרצו להמשיך?',
  buttons: [
    { id: 'event_add_new', title: 'פרסום אירוע 📅' },
    { id: 'event_update', title: 'עדכון אירוע ✏️' },
    { id: 'event_delete', title: 'מחיקת אירוע 🗑️' },
  ],
}

/** Dead end for update/delete until implemented. */
export const PUBLISHER_ACTION_COMING_SOON =
  'האפשרות הזו תגיע בקרוב. בינתיים אפשר לפרסם אירוע חדש או לחזור לתפריט.'

// --- Publisher event list (update / delete flow) ---

/** Shown when user has no future events (update or delete). */
export const EVENT_LIST_NO_FUTURE_EVENTS = 'לא נמצאו אירועים עתידיים שמשוייכים לך.'
/** When fetch of publisher events fails (API/network error). */
export const EVENT_LIST_FETCH_ERROR = 'שגיאה בטעינת האירועים. נסו שוב מאוחר יותר.'

/** List body when selecting which event to update. */
export const EVENT_UPDATE_SELECT_BODY = 'איזה אירוע תרצו לעדכן?'

/** List body when selecting which event to delete. */
export const EVENT_DELETE_SELECT_BODY = 'איזה אירוע תרצו למחוק?'

/** Publisher event list: list button label (update/delete – "איזה אירוע תרצו למחוק/לעדכן"). */
export const EVENT_SELECT_EVENT_LIST_BUTTON = 'בחרו אירוע מהרשימה'

/** "More events" row title; id is built as event_list_more_${offset}. */
export const EVENT_LIST_MORE_ROW_TITLE = 'אירועים נוספים'

/** WhatsApp list row title max length (crop + ellipsis). */
export const EVENT_LIST_ROW_TITLE_MAX = 24

/** Delete confirmation: prompt before user sends keyword. */
export const EVENT_DELETE_CONFIRM_PROMPT =
  "אתם בטוחים?\nלמחיקת האירוע באופן סופי שלחו 'מחיקה'"

/** Delete confirmation: exact text user must send to confirm. */
export const EVENT_DELETE_CONFIRM_KEYWORD = 'מחיקה'

/** After successful delete. */
export const EVENT_DELETE_SUCCESS = 'האירוע נמחק בהצלחה'

/** Buttons after no events: back to main menu, add new event. */
export const EVENT_LIST_NO_EVENTS_BUTTONS = [
  { id: 'back_to_main', title: 'חזרה לתפריט הראשי' },
  { id: 'event_add_new', title: 'פרסום אירוע 📅' },
]

/** Buttons after delete success: back to publisher choice, main menu. */
export const EVENT_DELETE_SUCCESS_BUTTONS = [
  { id: 'publish', title: 'פרסום/עדכון אירוע' },
  { id: 'back_to_main', title: 'חזרה לתפריט הראשי' },
]

/** To publisher: rejected. Body without reason; append PUBLISHER_REJECTED_REASON_LINE + reason only when relevant. */
export const PUBLISHER_REJECTED_BODY =
  '*לצערנו* הבקשה שלך לפרסום בגלילו"ז נדחתה... 😣'
export const PUBLISHER_REJECTED_REASON_LINE = '*סיבת הדחייה:* '
export const PUBLISHER_REJECTED_FOOTER = '_ניתן לבקש אישור מחדש_'
export const PUBLISHER_REJECTED_BUTTON = { id: 'back_to_main', title: 'בחזרה לתפריט הראשי' }

/** Approver: confirmation after action. Use {fullName} (fallback: מפרסם) */
export const APPROVER_CONFIRM_APPROVED = '*{fullName}* אושר כמפרסם בהצלחה ✅'
export const APPROVER_CONFIRM_REJECTED = '*{fullName}* לא אושר/ה כמפרסם/ת ❌.'

// --- Event add flow (publisher adds new event) ---

export const EVENT_ADD_INITIAL =
  'בואו נפרסם אירוע חדש.\n_• בכל שלב ניתן לשלוח *ביטול* על מנת לחזור לתפריט הראשי_\n_• לא לדאוג, תמיד אפשר לערוך את כל הפרטים בסיום._'

export const EVENT_ADD_ASK_TITLE = 'שם האירוע (חובה)'

export const EVENT_ADD_ASK_DATETIME = 'מתי האירוע קורה? (חובה)'
export const EVENT_ADD_ASK_DATETIME_FOOTER = 'כתבו בשפה חופשית את תאריך/תאריכי ושעות האירוע'

export const EVENT_ADD_CATEGORY_INTRO = 'בואו נשייך את האירוע שלכם לקטגוריה ראשית'
export const EVENT_ADD_ASK_CATEGORY_GROUP = 'בחרו אחת מארבע הקבוצות הבאות'
export const EVENT_ADD_ASK_MAIN_CATEGORY = 'בחרו את הקטגוריה המתאימה ביותר לאירוע שלכם'
export const EVENT_ADD_CATEGORY_FOOTER = 'אנחנו כבר נשייך את האירוע לקטגוריות נוספות'
export const EVENT_ADD_CATEGORY_AI_NOTE = '_אנחנו כבר נשייך את האירוע לקטגוריות נוספות_'
export const EVENT_ADD_CHANGE_GROUP_PROMPT = 'לא מתאים? אפשר לבחור קבוצה אחרת.'
export const EVENT_ADD_CHANGE_GROUP_BUTTON = { id: 'event_add_change_group', title: 'בחירת קבוצה אחרת' }
/** Row title for "change category group" at top of category list (max 24 chars). */
export const EVENT_ADD_CHANGE_GROUP_ROW_TITLE = 'קבוצת קטגוריות אחרת'

export const EVENT_ADD_LOCATION_INTRO = '*מיקום האירוע*\nאנא מלאו את פרטי המיקום'

export const EVENT_ADD_ASK_PLACE_NAME = 'שם המקום'
export const EVENT_ADD_SKIP_BUTTON = { id: 'event_add_skip', title: 'דלג' }

/** Same id as skip; use in EVENT_ADD_MEDIA / EVENT_ADD_MEDIA_MORE only. */
export const EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON_ID = 'event_add_skip'
/** First media ask: "no media" quick reply. */
export const EVENT_ADD_NO_MEDIA_BUTTON = {
  id: EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON_ID,
  title: 'ללא תמונות/סרטונים',
}
/** "ניתן לשלוח עוד X..." message: done uploading quick reply. */
export const EVENT_ADD_MEDIA_DONE_BUTTON = {
  id: EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON_ID,
  title: 'סיימתי להעלות קבצים',
}
/** @deprecated Use EVENT_ADD_NO_MEDIA_BUTTON or EVENT_ADD_MEDIA_DONE_BUTTON per context; same id. */
export const EVENT_ADD_SKIP_MEDIA_FINISH_BUTTON = EVENT_ADD_NO_MEDIA_BUTTON

export const EVENT_ADD_ASK_CITY = 'יישוב'

export const EVENT_ADD_ASK_REGION = 'באיזה אזור האירוע?'
/** Shown when user chose custom city (not from list). */
export const EVENT_ADD_ASK_REGION_SUBTITLE_CUSTOM =
  'בחרו את האזור המתאים ביותר על מפת גלילו"ז'
/** Image path relative to app base URL (use config.galiluzAppUrl + this). */
export const EVENT_ADD_ASK_REGION_IMAGE_PATH = '/imgs/areas-filter-map.png'
/** Region buttons for EVENT_ADD_REGION step (id = region key, title = region label). */
export const EVENT_ADD_REGION_BUTTONS = [
  { id: 'center', title: 'הגליל העליון המרכזי' },
  { id: 'golan', title: 'צפון ומרכז רמת הגולן' },
  { id: 'upper', title: 'אצבע הגליל' },
]

export const EVENT_ADD_ASK_ADDRESS = 'כתובת'
export const EVENT_ADD_ASK_ADDRESS_FOOTER = 'עד שתי שורות'

export const EVENT_ADD_ASK_LOCATION_NOTES = 'הערות נוספות למיקום'
export const EVENT_ADD_ASK_LOCATION_NOTES_FOOTER = 'לדוגמה - הכוונה של איך להגיע לכניסה'

export const EVENT_ADD_ASK_WAZE_GMAPS =
  'ניתן להוסיף לינקים למיקום ספציפי או לניווט עם Waze.'

export const EVENT_ADD_ASK_PRICE = 'מחיר האירוע'
export const EVENT_ADD_ASK_PRICE_FOOTER = 'לדוגמה - 20 ש"ח / חינם'

export const EVENT_ADD_ASK_DESCRIPTION =
  'תיאור מלא של האירוע (חובה)\n_ללא לינקים ומספרי טלפון, ניתן להוסיף לינקים וטלפונים בשדה הבא_'

export const EVENT_ADD_ASK_LINKS = 'ניתן להוסיף לינקים וטלפונים'
export const EVENT_ADD_ASK_LINKS_FOOTER = 'יש להוסיף תיאור לכל לינק. לדוגמה: tickets.co.il'

export const EVENT_ADD_ASK_MEDIA_FIRST =
  'הוספת תמונות וסרטונים\nשלח/י תמונה/סרטון ראשי'

/** First line (plain); second line in example format: _X/max קבצים נטענו_ */
export const EVENT_ADD_ASK_MEDIA_MORE = 'ניתן לשלוח עוד תמונה/סרטון'

/** "More media" message when exactly one slot left. */
export const EVENT_ADD_MEDIA_MORE_ONE = 'ניתן לשלוח עוד תמונה/סרטון אחד'
/** "More media" message when multiple slots left. Use .replace('{remaining}', count). */
export const EVENT_ADD_MEDIA_MORE_MANY_TEMPLATE = 'ניתן לשלוח עוד {remaining} תמונות/סרטונים'

/** Shown before format/process (italic). Bold line + excited emoji above, then current text. */
export const EVENT_ADD_PROCESSING_MESSAGE =
  '*זהו! סיימנו! 🤩*\n\n_אנחנו מעבדים את הפרטים שהזנת, זה יכול לקחת כמה רגעים..._'

export const EVENT_ADD_MEDIA_MAX_REACHED = 'נשמרו 6 קבצים. ממשיכים לשלב הבא.'

/** Final success: heading line (with emoji). */
export const EVENT_ADD_SUCCESS_HEADING = 'סיימנו! 🤩'
/** Final success: bold body line. */
export const EVENT_ADD_SUCCESS_BODY = '*האירוע שלכם נוסף לגלילו"ז בהצלחה!*'
/** Final success: prompt before event link. */
export const EVENT_ADD_SUCCESS_VIEW_PROMPT = 'מוזמנים לצפות באירוע שלכם כאן:'
/** Final success: quick reply – add another event. */
export const EVENT_ADD_SUCCESS_ADD_AGAIN_BUTTON = { id: 'event_add_new', title: 'להוספת אירוע חדש' }
/** Final success: quick reply – main menu. */
export const EVENT_ADD_SUCCESS_MAIN_MENU_BUTTON = { id: 'back_to_main', title: 'לתפריט הראשי' }

export const EVENT_ADD_SUCCESS = 'תודה, האירוע נשמר'

/** Confirm step: intro before formatted preview. */
export const EVENT_ADD_CONFIRM_INTRO = 'עיבדנו את פרטי האירוע שהזנת\nהאם כל הפרטים נכונים?'

/** Confirm step: approve and save button. */
export const EVENT_ADD_CONFIRM_SAVE_BUTTON = { id: 'event_confirm_save', title: 'אישור ושמירה' }

/** Confirm step: edit details (restart form) button. */
export const EVENT_ADD_CONFIRM_EDIT_BUTTON = { id: 'event_confirm_edit', title: 'עריכת פרטים' }

/** When user chooses edit: restart from title. */
export const EVENT_ADD_CONFIRM_EDIT_RESTART = 'מתחילים מחדש. הזן את פרטי האירוע.'

// --- Event edit flow (shared with future update flow) ---
export const EVENT_EDIT_MENU_BODY = 'אילו פרטים תרצו לשנות?'
export const EVENT_EDIT_MENU_FOOTER = "לסיום העריכה יש לבחור בתפריט ב'סיימתי לעדכן פרטים'"
/** First message when entering edit (free-language or menu). */
export const EVENT_EDIT_MENU_FIRST_BODY =
  'ניתן להשתמש בשפה חופשית כדי לעדכן פרטים, מה ברצונך לעדכן?\nלחילופין, ניתן לבחור שדה לעדכון מהתפריט'
/** First message footer (max 60 chars). */
export const EVENT_EDIT_MENU_FIRST_FOOTER =
  "לסיום העדכון - כתבו 'סיימתי לעדכן' או בחרו אפשרות זו מהרשימה"
export const EVENT_EDIT_DONE_ID = 'edit_done'
export const EVENT_EDIT_DONE_LABEL = 'סיימתי לעדכן פרטים'
/** Edit menu: list button label (WhatsApp interactive list). */
export const EVENT_EDIT_LIST_BUTTON = 'בחירת שדה לעריכה'
/** Edit menu: section title for "done updating" row. */
export const EVENT_EDIT_SECTION_DONE = 'סיום עריכה'
/** Edit menu: section title for field rows. */
export const EVENT_EDIT_SECTION_FIELDS = 'עריכת שדות'
/** Location edit menu: section title for back/done rows. */
export const EVENT_EDIT_SECTION_NAV = 'ניווט'
/** Location edit menu: section title for location field rows. */
export const EVENT_EDIT_SECTION_LOCATION_FIELDS = 'שדות מיקום'
export const EVENT_EDIT_DONE_ROW = { id: 'edit_done', title: 'סיימתי לעדכן פרטים' }
export const EVENT_EDIT_ASK_TITLE = 'הזינו שם חדש לאירוע'
export const EVENT_EDIT_ASK_DESCRIPTION = 'הזינו תיאור חדש לאירוע'
export const EVENT_EDIT_ASK_DATETIME = 'הזינו תאריכים ושעות חדשים'
export const EVENT_EDIT_ASK_DATETIME_FOOTER = EVENT_ADD_ASK_DATETIME_FOOTER
export const EVENT_EDIT_ASK_PRICE = EVENT_ADD_ASK_PRICE
export const EVENT_EDIT_ASK_PRICE_FOOTER = EVENT_ADD_ASK_PRICE_FOOTER
/** Shown when price edit fails to parse user input. */
export const EVENT_EDIT_PRICE_PARSE_FAIL_MESSAGE =
  'לא הצלחתי להבין מה מחיר האירוע, בבקשה הזן מחיר מחדש'
/** Quick reply to return to edit menu without updating price. */
export const EVENT_EDIT_PRICE_BACK_TO_MENU_BUTTON = { id: 'edit_price_back_to_menu', title: 'חזרה לתפריט' }
export const EVENT_EDIT_ASK_LINKS = 'הזינו לינקים וטלפונים'
export const EVENT_EDIT_ASK_LINKS_FOOTER = EVENT_ADD_ASK_LINKS_FOOTER
export const EVENT_EDIT_ASK_MEDIA = 'ניתן להעלות תמונות וסרטונים חדשים, נתחיל בתמונה/סרטון הראשיים'
/** Footer for edit media intro (max 60 chars). */
export const EVENT_EDIT_ASK_MEDIA_FOOTER = 'כל התמונות והסרטונים הקודמים יימחקו'
export const EVENT_EDIT_MEDIA_CANCEL_BUTTON = { id: 'edit_media_cancel', title: 'לא משנה, התחרטתי' }
export const EVENT_EDIT_FIELD_IDS = {
  EDIT_TITLE: 'edit_title',
  EDIT_DESCRIPTION: 'edit_description',
  EDIT_MAIN_CATEGORY: 'edit_main_category',
  EDIT_EXTRA_CATEGORIES: 'edit_extra_categories',
  EDIT_LOCATION: 'edit_location',
  EDIT_DATETIME: 'edit_datetime',
  EDIT_PRICE: 'edit_price',
  EDIT_MEDIA: 'edit_media',
  EDIT_LINKS: 'edit_links',
  EDIT_DONE: 'edit_done',
}
export const EVENT_EDIT_MENU_ROWS = [
  { id: 'edit_title', title: 'שם האירוע' },
  { id: 'edit_description', title: 'תיאור האירוע' },
  { id: 'edit_main_category', title: 'קטגוריה ראשית' },
  { id: 'edit_extra_categories', title: 'קטגוריות נוספות' },
  { id: 'edit_location', title: 'מיקום האירוע' },
  { id: 'edit_datetime', title: 'תאריכים ושעה' },
  { id: 'edit_price', title: 'מחיר' },
  { id: 'edit_media', title: 'תמונות וסרטונים' },
  { id: 'edit_links', title: 'לינקים וטלפונים' },
]

/** After a field was updated: success message per field (body for quick-reply screen). */
export const EVENT_EDIT_SUCCESS_MESSAGES = {
  title: 'שם האירוע עודכן בהצלחה',
  description: 'תיאור האירוע עודכן בהצלחה',
  mainCategory: 'קטגוריה ראשית עודכנה בהצלחה',
  location: 'מיקום האירוע עודכן בהצלחה',
  datetime: 'תאריכים ושעות עודכנו בהצלחה',
  price: 'מחיר עודכן בהצלחה',
  links: 'לינקים וטלפונים עודכנו בהצלחה',
  media: 'תמונות וסרטונים עודכנו בהצלחה',
}

/** Placeholder when edited field value is empty (edit-success value block). */
export const EVENT_EDIT_SUCCESS_VALUE_EMPTY = 'ללא'

/** Quick replies after field edit: done updating / more fields to edit. */
export const EVENT_EDIT_SUCCESS_DONE_BUTTON = { id: 'edit_success_done', title: 'סיימתי לעדכן' }
export const EVENT_EDIT_SUCCESS_MORE_BUTTON = { id: 'edit_success_more', title: 'לעדכון פרטים נוספים' }
/** Shown after location field edit: go back to location menu (max 20 chars for button). */
export const EVENT_EDIT_SUCCESS_MORE_LOCATION_BUTTON = { id: 'edit_success_more_location', title: 'לעדכון נוסף במיקום' }

/** Body for "choose" quick-reply screen after field edit. */
export const EVENT_EDIT_SUCCESS_CHOOSE_BODY = 'בחר/י:'

/** Shown when patch (draft update) fails. */
export const EVENT_EDIT_PATCH_ERROR = 'שגיאה בעדכון. נסה שוב.'

/** Free-language edit: LLM could not understand the request. */
export const EVENT_EDIT_FREE_LANG_UNCLEAR =
  'לא הצלחתי להבין מה בדיוק אתם מבקשים לעדכן, אשמח אם תכתבו בצורה ברורה יותר או תבחרו שדה מתוך הרשימה'

/** Free-language suggested edits: confirm / cancel buttons (max 20 chars). */
export const EVENT_EDIT_FREE_LANG_CONFIRM_BUTTON = { id: 'edit_freelang_confirm', title: 'מאשר/ת עדכון! 👍' }
export const EVENT_EDIT_FREE_LANG_CANCEL_BUTTON = { id: 'edit_freelang_cancel', title: 'לא מאשר/ת עדכון 👎' }

/** Free-language suggested-edits intro (body before the changes list). */
export const EVENT_EDIT_FREE_LANG_SUGGESTED_INTRO = 'אלו השינויים שזיהינו שברצונך לבצע:'

/** After free-language confirm success: prompt and quick replies. */
export const EVENT_EDIT_FREE_LANG_SUCCESS_PROMPT = 'איך תרצו להמשיך?'
export const EVENT_EDIT_FREE_LANG_SUCCESS_MORE_BUTTON = { id: 'edit_freelang_success_more', title: 'לעדכון עוד פרטים' }
export const EVENT_EDIT_FREE_LANG_SUCCESS_DONE_BUTTON = { id: 'edit_freelang_success_done', title: 'לסיום' }

/** Extra categories: cannot remove last remaining category. */
export const EVENT_EDIT_EXTRA_CANNOT_REMOVE_LAST = 'לא ניתן להסיר את הקטגוריה היחידה.'

/** Location edit: city normalization failed. */
export const EVENT_EDIT_LOCATION_CITY_UNRECOGNIZED = 'לא הצלחנו לזהות יישוב. נסה שוב.'

/** Max categories per event (main + additional). Used in extra-categories edit flow. */
export const EVENT_ADD_MAX_CATEGORIES = 4
/** Max *extra* categories (excluding main). Shown in "cannot add more" message since main is not in the list. */
export const EVENT_ADD_MAX_EXTRA_CATEGORIES = EVENT_ADD_MAX_CATEGORIES - 1

/** Extra categories edit: body and buttons. */
export const EVENT_EDIT_EXTRA_CATEGORIES_BODY = 'אלו הקטגוריות אליהן משויך כעת האירוע'
export const EVENT_EDIT_EXTRA_CATEGORIES_NO_EXTRAS = 'אין קטגוריות נוספות.'
export const EVENT_EDIT_EXTRA_ADD_BUTTON = { id: 'edit_extra_add', title: 'להוסיף קטגוריה' }
export const EVENT_EDIT_EXTRA_REMOVE_BUTTON = { id: 'edit_extra_remove', title: 'להסיר קטגוריה' }
export const EVENT_EDIT_EXTRA_BACK_BUTTON = { id: 'edit_extra_back', title: 'חזרה' }
export const EVENT_EDIT_EXTRA_MAX_REACHED = (max) => `לא ניתן להוסיף יותר מ-${max} קטגוריות`
export const EVENT_EDIT_EXTRA_REMOVE_ASK = 'איזו קטגוריה להסיר?'
export const EVENT_EDIT_EXTRA_NO_REMOVE = 'אין קטגוריות להסיר.'

/** Location edit menu: body, footer, section rows and prompts. */
export const EVENT_EDIT_LOCATION_MENU_BODY = 'אילו פרטים במיקום האירוע תרצו לשנות:'
/** Footer for location list (WhatsApp max 60 chars). */
export const EVENT_EDIT_LOCATION_MENU_FOOTER =
  'לחזרה או סיום העריכה - בחרו באפשרויות שבראש התפריט'
export const EVENT_EDIT_LOCATION_BACK_ROW = { id: 'loc_back', title: 'לעדכון פרטים אחרים' }
export const EVENT_EDIT_LOCATION_DONE_ROW = { id: 'loc_done', title: 'סיימתי לעדכן פרטים' }
export const EVENT_EDIT_LOCATION_FIELD_ROWS = [
  { id: 'loc_place_name', title: 'שם המקום' },
  { id: 'loc_city', title: 'יישוב' },
  { id: 'loc_region', title: 'אזור' },
  { id: 'loc_address', title: 'כתובת' },
  { id: 'loc_details', title: 'הוראות הגעה' },
  { id: 'loc_gmaps', title: 'לינק Google Maps' },
  { id: 'loc_waze', title: 'לינק Waze' },
]
export const EVENT_EDIT_LOCATION_ASK_PLACE_NAME = 'הזינו שם מקום חדש למיקום האירוע'
export const EVENT_EDIT_LOCATION_ASK_CITY = 'הזינו יישוב חדש'
export const EVENT_EDIT_LOCATION_ASK_REGION = 'בחרו אזור חדש'
export const EVENT_EDIT_LOCATION_ASK_ADDRESS = 'הזינו כתובת חדשה'
export const EVENT_EDIT_LOCATION_ASK_DETAILS = 'הזינו הוראות הגעה חדשות'
export const EVENT_EDIT_LOCATION_ASK_GMAPS = 'הזינו לינק לניווט עם Google Maps'
export const EVENT_EDIT_LOCATION_ASK_WAZE = 'הזינו לינק לניווט עם Waze'

/** Format API failed; ask to try again. */
export const EVENT_ADD_FORMAT_FAILED = 'לא הצלחנו לעבד את הפרטים. נסה שוב.'

/** After format failed: body for retry button (do not repeat upload status). */
export const EVENT_ADD_FORMAT_FAILED_RETRY_BODY = 'לחץ למטה כדי לנסות שוב לעבד'

/** Format failed: quick reply button (same id as media finish so re-process runs). */
export const EVENT_ADD_FORMAT_RETRY_BUTTON = { id: 'event_add_skip', title: 'שלח/י שוב' }

/** When AI raised flags: intro before listing fields we could not understand. */
export const EVENT_ADD_FLAGS_INTRO = 'יש כמה פרטים שלא הצלחנו להבין:'

/** When AI raised flags: line under the flags list, before asking for inputs again. */
export const EVENT_ADD_FLAGS_FILL_AGAIN = 'בואו נמלא את הפרטים האלו שוב בבקשה...'

// --- Event add validation (limits and error messages) ---

export const EVENT_ADD_TITLE_MIN = 6
export const EVENT_ADD_TITLE_MAX = 80
export const EVENT_ADD_DATETIME_MAX = 200
export const EVENT_ADD_PLACE_NAME_MAX = 40
export const EVENT_ADD_CITY_MAX = 40
export const EVENT_ADD_ADDRESS_MAX = 100
export const EVENT_ADD_LOCATION_NOTES_MAX = 100
export const EVENT_ADD_WAZE_GMAPS_MAX = 3000
export const EVENT_ADD_PRICE_MAX = 50
export const EVENT_ADD_DESCRIPTION_MIN = 70
export const EVENT_ADD_DESCRIPTION_MAX = 3000
export const EVENT_ADD_LINKS_MAX = 3000

export const EVENT_ADD_VALIDATE_TITLE = 'שם האירוע חייב להכיל בין 6 ל־80 תווים.'
export const EVENT_ADD_VALIDATE_DATETIME = 'תשובה חייבת להיות עד 200 תווים.'
export const EVENT_ADD_VALIDATE_MAIN_CATEGORY_GROUP = 'נא לבחור קבוצה מהרשימה.'
export const EVENT_ADD_VALIDATE_MAIN_CATEGORY = 'נא לבחור קטגוריה מהרשימה.'
export const EVENT_ADD_VALIDATE_PLACE_NAME = 'שם המקום עד 40 תווים.'
export const EVENT_ADD_VALIDATE_CITY = 'יישוב עד 40 תווים.'
export const EVENT_ADD_VALIDATE_ADDRESS = 'כתובת: עד שתי שורות, כל שורה עד 100 תווים. נא להזין שוב.'
export const EVENT_ADD_VALIDATE_LOCATION_NOTES = 'הערות מיקום עד 100 תווים.'
export const EVENT_ADD_VALIDATE_WAZE_GMAPS = 'קישורים עד 3000 תווים.'
export const EVENT_ADD_VALIDATE_PRICE = 'מחיר עד 50 תווים.'
export const EVENT_ADD_VALIDATE_DESCRIPTION = 'תיאור חייב להכיל בין 70 ל־3000 תווים.'
export const EVENT_ADD_VALIDATE_LINKS = 'לינקים עד 3000 תווים.'
export const EVENT_ADD_VALIDATE_MEDIA = 'נא לשלוח תמונה או סרטון, או ללחוץ דלג.'
export const EVENT_ADD_MEDIA_UPLOAD_FAILED =
  'שמירת התמונה/סרטון נכשלה (שירות לא זמין כרגע). נסה/י שוב או לחץ/י דלג.'

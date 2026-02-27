/**
 * Wa-bot constants. Grouped by flow for shorter imports.
 * Use: import { EVENT_ADD, EVENT_EDIT, LOG_PREFIXES } from '../consts/index.js'
 */

/** Log prefixes for wa-bot services. */
export const LOG_PREFIXES = {
  MAIN: '[Main]',
  CONFIG: '[Config]',
  WEBHOOK: '[Webhook]',
  CLOUD_API: '[CloudAPI]',
  EVENT_ADD: '[EventAdd]',
  SHUTDOWN: '[Shutdown]',
  FATAL: '[Fatal]',
}

/** WhatsApp Cloud API version. */
export const API_VERSION = 'v22.0'

/** Webhook message batching: idle ms before flushing pending messages into processing queue. */
export const BATCH_FLUSH_MS = 250

// --- WELCOME & MAIN MENU (WELCOME before MAIN_MENU - shared ref) ---

export const WELCOME = {
  INTERACTIVE: {
    body: 'היי! 👋\nאני הבוט של אפליקציית *גלילו"ז* - Galiluz\n\nכנסו לאפליקציה כדי לגלות כל מה שקורה בצפון\n*גלילו"ז*🏔️ - https://galiluz.co.il\n\n*איך אפשר לעזור לכם?* 😊',
    buttons: [
      { id: 'discover', title: '?מה קורה בצפון 🏔️' },
      { id: 'publish', title: 'פרסום/עדכון אירוע 📅' },
      { id: 'contact', title: 'צרו קשר 📩' },
    ],
  },
  MAIN_MENU_RETURN: {
    body: '*איך אפשר לעזור לכם?* 😊\n\nאתם מוזמנים לכתוב לי או לבחור באחת האפשרויות',
    get buttons() {
      return WELCOME.INTERACTIVE.buttons
    },
  },
}

export const CONTACT = {
  MESSAGE:
    'לצורך יצירת קשר ניתן לשלוח הודעה ישירות:\n055-989-6278',
}

export const MAIN_MENU = {
  INTENT_IRRELEVANT: {
    body: 'אין לנו איך לעזור לכם עם הבקשה הזו בשלב זה.\nאם תרצו, אפשר:',
    get buttons() {
      return WELCOME.INTERACTIVE.buttons
    },
  },
  INTENT_UNCLEAR: {
    body: 'לא הצלחנו להבין מה תרצו לעשות,\nמוזמנים לכתוב שוב, או:',
    get buttons() {
      return WELCOME.INTERACTIVE.buttons
    },
  },
  PUBLISHER_ONLY:
    'רק מפרסמים מאושרים יכולים לעדכן או למחוק אירועים.',
}

// --- DISCOVER ---

export const DISCOVER = {
  ASK_CATEGORY: 'איזה אירועים את/ה מחפש/ת?',
  ASK_TIME: {
    body: 'מתי?',
    footer: 'לצפייה בכל האירועים כנסו ל־ galiluz.co.il',
    buttons: [
      { id: 'today', title: 'היום' },
      { id: 'tomorrow', title: 'מחר' },
    ],
  },
  AFTER_LIST_FOOTER: 'לצפייה בכל האירועים כנסו ל־ galiluz.co.il',
  /**
   * After-list payload: "בחרו קטגוריה אחרת", optional "אותה קטגוריה היום/מחר", "בחזרה לתפריט הראשי".
   * "אותה קטגוריה X" appears only when the OTHER day has not been searched yet for this category.
   * @param {'today' | 'tomorrow'} timeChoice - what the user just searched
   * @param {Array<'today'|'tomorrow'>} searchedTimesForCategory - which time options user already searched for this category
   */
  getAfterListPayload(timeChoice, searchedTimesForCategory = []) {
    const searched = new Set(Array.isArray(searchedTimesForCategory) ? searchedTimesForCategory : [])
    const otherDay = timeChoice === 'today' ? { id: 'tomorrow', title: 'אותה קטגוריה מחר' } : { id: 'today', title: 'אותה קטגוריה היום' }
    const showSameCategoryOtherDay = !searched.has(otherDay.id)
    const buttons = [
      ...(showSameCategoryOtherDay ? [otherDay] : []),
      { id: 'discover', title: 'בחרו קטגוריה אחרת' },
      { id: 'back_to_main', title: 'בחזרה לתפריט הראשי' },
    ]
    return {
      body: 'לא מצאת מה שחיפשת?',
      footer: this.AFTER_LIST_FOOTER,
      buttons,
    }
  },
}

// --- PUBLISH ---

export const PUBLISH = {
  NOT_REGISTERED: {
    body:
      "*פעם ראשונה?* 🤩\nבואו נעבור אימות קצרצר (זה לוקח דקה)\n\n _חשוב לנו לוודא שרק מפרסמים מאומתים מעלים אירועים אמיתיים ולגיטימיים למערכת_ ",
    buttons: [
      { id: 'publish_sign_me_up', title: 'בואו נתחיל' },
      { id: 'back_to_main', title: 'בחזרה לתפריט הראשי' },
    ],
  },
  CONNECTION_ERROR: {
    body:
      'נתקלנו בבעיה זמנית בחיבור למערכת. אנא נסו שוב מאוחר יותר.',
    buttons: [{ id: 'back_to_main', title: 'בחזרה לתפריט הראשי' }],
  },
  ASK_FULL_NAME: 'מה השם המלא שלך?',
  ASK_PUBLISHING_AS:
    'מטעם מי אתם מפרסמים?\n_יוזמה פרטית / שם העסק_',
  ASK_EVENT_TYPES:
    'אילו אירועים אתם מתכוונים לפרסם בגלילו"ז?\n(תיאור כללי)\n_לדוגמה - מסיבה בפאב השכונתי_',
  ASK_COMMITMENT: {
    body:
      '_אני מתחייב/ת_ לפרסם אירועים בצפון בלבד ולציין פרטים מלאים ומהימנים של כל אירוע שאפרסם.',
    buttons: [
      { id: 'publish_commit_yes', title: 'מתחייב/ת' },
      { id: 'back_to_main', title: 'בחזרה לתפריט הראשי' },
    ],
  },
  THANK_YOU: {
    body:
      '*זהו! סיימנו* 🤩\nאנחנו נבדוק את הפרטים ששלחת וברגע שנאשר - *תקבל/י מאיתנו הודעה* ותוכל/י להתחיל לפרסם אירועים!',
    buttons: [{ id: 'back_to_main', title: 'בחזרה לתפריט הראשי' }],
  },
  PENDING_MESSAGE:
    'אנחנו בודקים את הפרטים שהעברת. *תקבל/י מאיתנו הודעת וואטסאפ* ברגע שאושרת. עד אז אפשר להיכנס לאתר גלילו"ז.',
  REGISTER_ERROR: 'משהו השתבש. נסו שוב מאוחר יותר.',
  EXPECT_TEXT: 'אנא השיבו בטקסט בלבד.',
}

// --- APPROVER ---

export const APPROVER = {
  REQUEST_BODY_TEMPLATE:
    '*בקשת הרשמה כמפרסם/ת:*\n*שם מלא:* {fullName}\n*מטעם:* {publishingAs}\n*סוג אירועים:* {eventTypes}\n*מזהה וואטסאפ:* {waId}',
  BUTTONS: {
    approve: { idPrefix: 'approve_', title: 'לאשר מפרסם ✅' },
    reject: { idPrefix: 'reject_', title: 'לא לאשר מפרסם ❌' },
    rejectNoReason: { idPrefix: 'reject_no_reason_', title: 'דחה ללא סיבה' },
  },
  ASK_REASON: {
    body: 'מה סיבת הדחייה?',
    noReasonButton: { idPrefix: 'no_reason_', title: 'ללא סיבה' },
  },
  CONFIRM_APPROVED: '*{fullName}* אושר כמפרסם בהצלחה ✅',
  CONFIRM_REJECTED: '*{fullName}* לא אושר/ה כמפרסם/ת ❌.',
}

// --- PUBLISHER ---

export const PUBLISHER = {
  APPROVED: {
    body:
      '*את/ה מאושר/ת!* (תרתי משמע 😉)\nמעכשיו את/ה יכול/ה לפרסם אירועים בגלילו"ז',
    buttons: [
      { id: 'publish', title: 'לפרסום אירוע' },
      { id: 'back_to_main', title: 'בחזרה לתפריט הראשי' },
    ],
  },
  HOW_TO_CONTINUE: {
    body: 'איך תרצו להמשיך?',
    buttons: [
      { id: 'event_add_new', title: 'פרסום אירוע 📅' },
      { id: 'event_update', title: 'עדכון אירוע ✏️' },
      { id: 'event_delete', title: 'מחיקת אירוע 🗑️' },
    ],
  },
  REJECTED_BODY: '*לצערנו* הבקשה שלך לפרסום בגלילו"ז נדחתה... 😣',
  REJECTED_REASON_LINE: '*סיבת הדחייה:* ',
  REJECTED_FOOTER: '_ניתן לבקש אישור מחדש_',
  REJECTED_BUTTON: { id: 'back_to_main', title: 'בחזרה לתפריט הראשי' },
}

// --- EVENT LIST (update/delete flow) ---

export const EVENT_LIST = {
  NO_FUTURE_EVENTS: 'לא נמצאו אירועים עתידיים שמשוייכים לך.',
  FETCH_ERROR: 'שגיאה בטעינת האירועים. נסו שוב מאוחר יותר.',
  UPDATE_SELECT_BODY: 'איזה אירוע תרצו לעדכן?',
  DELETE_SELECT_BODY: 'איזה אירוע תרצו למחוק?',
  SELECT_EVENT_LIST_BUTTON: 'בחרו אירוע מהרשימה',
  MORE_ROW_TITLE: 'אירועים נוספים',
  ROW_TITLE_MAX: 24,
  DELETE_CONFIRM_PROMPT: "אתם בטוחים?\nלמחיקת האירוע באופן סופי שלחו 'מחיקה'",
  DELETE_CONFIRM_KEYWORD: 'מחיקה',
  DELETE_SUCCESS: 'האירוע נמחק בהצלחה',
  NO_EVENTS_BUTTONS: [
    { id: 'back_to_main', title: 'חזרה לתפריט הראשי' },
    { id: 'event_add_new', title: 'פרסום אירוע 📅' },
  ],
  DELETE_SUCCESS_BUTTONS: [
    { id: 'publish', title: 'פרסום/עדכון אירוע' },
    { id: 'back_to_main', title: 'חזרה לתפריט הראשי' },
  ],
}

// --- EVENT ADD (define before EVENT_EDIT - cross-refs) ---

const SKIP_MEDIA_FINISH_BUTTON_ID = 'event_add_skip'

export const EVENT_ADD = {
  METHOD_CHOICE_BODY: 'אפשר להוסיף אירוע בשתי דרכים:',
  METHOD_AI_BUTTON: { id: 'event_add_ai', title: 'הוספה מהירה עם AI' },
  METHOD_MANUAL_BUTTON: { id: 'event_add_manual', title: 'מילוי טופס פרטים' },
  AI_PROMPT_BODY: 'שלחו בהודעה אחת את כל פרטי האירוע',
  AI_PROMPT_FOOTER:
    'תיאור מלא, תאריכים, מיקום ומחיר. מאוחר יותר: תמונות וסרטונים',
  AI_BACK_BUTTON: { id: 'back_to_main', title: 'חזרה לתפריט' },
  AI_RETRY_BUTTON: { id: 'event_add_ai_retry', title: 'נסו שוב' },
  AI_EXPECT_TEXT: 'נא לשלוח את הפרטים בהודעת טקסט בלבד.',
  AI_PROCESSING_ACK: 'קיבלנו, תנו לנו כמה רגעים לעבד את הפרטים...',
  AI_NOT_EVENT_BODY:
    'המנוע שלנו לא הצליח לזהות פרטי אירוע בהודעה שלכם, תוכלו לנסות שוב?',
  AI_NO_CATEGORIES_BODY: 'משהו השתבש.',
  AI_EXTRACTION_FAILED_BODY: 'לא הצלחנו לעבד את ההודעה.',
  DRAFT_CREATE_FAILED_BODY: 'לא הצלחנו ליצור את האירוע.',
  INITIAL: {
    body: 'בואו נפרסם אירוע חדש.',
    footer: 'בכל שלב: ביטול לחזרה לתפריט. תמיד אפשר לערוך בסיום',
    buttons: [{ id: 'back_to_main', title: 'ביטול' }],
  },
  ASK_TITLE: 'שם האירוע (חובה)',
  ASK_DATETIME: 'מתי האירוע קורה? (חובה)',
  ASK_DATETIME_FOOTER: 'כתבו בשפה חופשית את תאריך/תאריכי ושעות האירוע',
  CATEGORY_INTRO: 'בואו נשייך את האירוע שלכם לקטגוריה ראשית',
  ASK_CATEGORY_GROUP: 'בחרו אחת מארבע הקבוצות הבאות',
  ASK_MAIN_CATEGORY: 'בחרו קטגוריה',
  CATEGORY_FOOTER: 'אנחנו כבר נשייך את האירוע לקטגוריות נוספות',
  CATEGORY_AI_NOTE: '_אנחנו כבר נשייך את האירוע לקטגוריות נוספות_',
  CHANGE_GROUP_PROMPT: 'לא מתאים? אפשר לבחור קבוצה אחרת.',
  CHANGE_GROUP_BUTTON: { id: 'event_add_change_group', title: 'בחירת קבוצה אחרת' },
  CHANGE_GROUP_ROW_TITLE: 'קבוצת קטגוריות אחרת',
  LOCATION_INTRO: '*מיקום האירוע*\nאנא מלאו את פרטי המיקום',
  ASK_PLACE_NAME: 'הזינו את שם המקום בו יתקיים האירוע',
  SKIP_BUTTON: { id: 'event_add_skip', title: 'דלגו' },
  SKIP_MEDIA_FINISH_BUTTON_ID,
  NO_MEDIA_BUTTON: {
    id: SKIP_MEDIA_FINISH_BUTTON_ID,
    title: 'ללא תמונות/סרטונים',
  },
  MEDIA_DONE_BUTTON: {
    id: SKIP_MEDIA_FINISH_BUTTON_ID,
    title: 'סיימתי להעלות קבצים',
  },
  ASK_CITY: 'הזינו שם ישוב',
  ASK_REGION: 'באיזה אזור האירוע?',
  ASK_REGION_IMAGE_PATH: '/imgs/areas-filter-map.png',
  REGION_BUTTONS: [
    { id: 'center', title: 'הגליל העליון המרכזי' },
    { id: 'golan', title: 'צפון ומרכז רמת הגולן' },
    { id: 'upper', title: 'אצבע הגליל' },
  ],
  ASK_ADDRESS: 'כתובת',
  ASK_ADDRESS_FOOTER: 'עד שתי שורות',
  ASK_LOCATION_NOTES: 'הערות נוספות למיקום',
  ASK_LOCATION_NOTES_FOOTER: 'לדוגמה - הכוונה של איך להגיע לכניסה',
  ASK_WAZE_GMAPS: 'הוספת לינקים לניווט עם google maps/waze',
  ASK_PRICE: 'מחיר האירוע',
  ASK_PRICE_FOOTER: 'לדוגמה - 20 ש"ח / חינם',
  ASK_DESCRIPTION:
    'תיאור מלא של האירוע (חובה)\n_ללא לינקים ומספרי טלפון, ניתן להוסיף לינקים וטלפונים בשדה הבא_',
  ASK_LINKS: 'הזינו לינקים וטלפונים',
  ASK_LINKS_FOOTER: 'יש להוסיף תיאור לכל לינק. לדוגמה: כרטיסים - tickets.co.il',
  ASK_MEDIA_FIRST: 'הוספת תמונות וסרטונים\nשלח/י תמונה/סרטון ראשי',
  ASK_MEDIA_MORE: 'ניתן לשלוח עוד תמונה/סרטון',
  MEDIA_MORE_ONE: 'ניתן לשלוח עוד תמונה/סרטון אחד',
  MEDIA_MORE_MANY_TEMPLATE: 'ניתן לשלוח עוד {remaining} תמונות/סרטונים',
  PROCESSING_MESSAGE:
    '*זהו! סיימנו! 🤩*\n\n_אנחנו מעבדים את הפרטים שהזנת, זה יכול לקחת כמה רגעים..._',
  MEDIA_MAX_REACHED: 'נשמרו 6 קבצים. ממשיכים לשלב הבא.',
  SUCCESS_HEADING: 'סיימנו! 🤩',
  SUCCESS_BODY: '*האירוע שלכם נוסף לגלילו"ז בהצלחה!*',
  SUCCESS_VIEW_PROMPT: 'מוזמנים לצפות באירוע שלכם כאן:',
  SUCCESS_ADD_AGAIN_BUTTON: { id: 'event_add_new', title: 'להוספת אירוע חדש' },
  SUCCESS_MAIN_MENU_BUTTON: { id: 'back_to_main', title: 'לתפריט הראשי' },
  SUCCESS: 'תודה, האירוע נשמר',
  CONFIRM_INTRO: 'עיבדנו את פרטי האירוע שהזנת\nהאם כל הפרטים נכונים?',
  CONFIRM_SAVE_BUTTON: { id: 'event_confirm_save', title: 'אישור ושמירה' },
  CONFIRM_EDIT_BUTTON: { id: 'event_confirm_edit', title: 'עריכת פרטים' },
  CONFIRM_EDIT_RESTART: 'מתחילים מחדש. הזן את פרטי האירוע.',
  MAX_CATEGORIES: 4,
  MAX_EXTRA_CATEGORIES: 3,
  FORMAT_FAILED: 'לא הצלחנו לעבד את הפרטים.',
  FORMAT_RETRY_BUTTON: { id: 'event_add_skip', title: 'נסו שוב' },
  SUBMIT_FAILED: 'משהו השתבש בשמירה. נסו שוב מאוחר יותר.',
  SUBMIT_FAILED_WITH_REASON: (reason) =>
    `משהו השתבש בשמירה: ${reason}\n\nנסו שוב מאוחר יותר.`,
  CONFIRM_SAVE_ERROR: 'משהו השתבש. נסו להתחיל מחדש.',
  FLAGS_INTRO: 'יש כמה פרטים שחסרים לנו.',
  FLAGS_FILL_PROMPT: 'מלאו את הפרטים הבאים:',
  CITY_OUTSIDE_REGION:
    'היישוב שציינת לא באיזור הצפון. אנא הזינו יישוב מתאים',
}

// --- VALIDATION (limits and messages) ---

export const VALIDATION = {
  REASON_TO_MESSAGE: {
    'Missing or empty Title': 'שם האירוע חובה. נסו שוב עם שם לא ריק.',
    'Missing or empty categories': 'חייבת להיות לפחות קטגוריה אחת. נסו שוב.',
    'Missing mainCategory':
      'לא ניתן למחוק את הקטגוריה הראשית — חייבת להישאר קטגוריה אחת לפחות. נסו לבחור קטגוריה אחרת במקום למחוק.',
    'mainCategory not in categories':
      'הקטגוריה הראשית חייבת להיות מתוך רשימת הקטגוריות. נסו שוב.',
    'Missing location': 'מיקום האירוע חובה. נסו שוב.',
    'Missing location.city': 'מיקום חייב לכלול יישוב או שם מקום. נסו שוב.',
    'Location must have at least locationName or city':
      'מיקום חייב לכלול שם מקום או יישוב. נסו שוב.',
    'Missing or empty occurrences': 'לא הצלחנו לזהות מתי מתקיים האירוע.',
    'occurrences[0].startTime must be ISO 8601 date-time': 'לא הצלחנו לזהות מתי מתקיים האירוע.',
    'occurrences[0].endTime must be after startTime': 'לא הצלחנו לזהות מתי מתקיים האירוע.',
  },
  PATCH_VALIDATION_DEFAULT: 'העדכון לא תקף. נסו שוב עם פרטים מלאים.',
  TITLE_MIN: 6,
  TITLE_MAX: 80,
  DATETIME_MAX: 300,
  PLACE_NAME_MAX: 40,
  CITY_MAX: 40,
  ADDRESS_MAX: 100,
  LOCATION_NOTES_MAX: 100,
  WAZE_GMAPS_MAX: 3000,
  PRICE_MAX: 50,
  DESCRIPTION_MIN: 70,
  DESCRIPTION_MAX: 3000,
  LINKS_MAX: 600,
  VALIDATE_TITLE: 'שם האירוע חייב להכיל בין 6 ל־80 תווים.',
  VALIDATE_DATETIME: 'עד 300 תווים בבקשה',
  VALIDATE_MAIN_CATEGORY_GROUP: 'נא לבחור קבוצה מהרשימה.',
  VALIDATE_MAIN_CATEGORY: 'נא לבחור קטגוריה מהרשימה.',
  VALIDATE_PLACE_NAME: 'שם המקום עד 40 תווים.',
  VALIDATE_CITY: 'יישוב עד 40 תווים.',
  VALIDATE_REGION: 'נא לבחור אזור',
  VALIDATE_ADDRESS:
    'כתובת: עד שתי שורות, כל שורה עד 100 תווים. נא להזין שוב.',
  VALIDATE_LOCATION_NOTES: 'הערות מיקום עד 100 תווים.',
  VALIDATE_WAZE_GMAPS: 'קישורים עד 3000 תווים.',
  VALIDATE_PRICE: 'מחיר עד 50 תווים.',
  VALIDATE_DESCRIPTION: 'תיאור חייב להכיל בין 70 ל־3000 תווים.',
  VALIDATE_LINKS: 'לינקים עד 600 תווים.',
  VALIDATE_MEDIA: 'נא לשלוח תמונה או סרטון, או לעבור לשלב הבא',
  MEDIA_UPLOAD_FAILED:
    'שמירת התמונה/סרטון נכשלה (שירות לא זמין כרגע). נסה/י שוב או לחץ/י דלגו.',
}

// --- EVENT EDIT ---

export const EVENT_EDIT = {
  MENU_BODY: 'אילו פרטים תרצו לשנות?',
  MENU_FOOTER: "לסיום העריכה יש לבחור בתפריט ב'סיימתי לעדכן פרטים'",
  MENU_FIRST_BODY:
    'איזה עדכון תרצו לבצע?\nכתבו בשפה חופשית או בחרו מהרשימה',
  MENU_FIRST_FOOTER:
    'לדוגמה: "תחליף את מחיר האירוע ל40"',
  DONE_ID: 'edit_done',
  DONE_LABEL: 'סיימתי לעדכן פרטים',
  LIST_BUTTON: 'בחירת שדה לעריכה',
  SECTION_DONE: 'סיום עריכה',
  SECTION_FIELDS: 'עריכת שדות',
  SECTION_NAV: 'ניווט',
  SECTION_LOCATION_FIELDS: 'שדות מיקום',
  DONE_ROW: { id: 'edit_done', title: 'סיימתי לעדכן פרטים' },
  ASK_TITLE: 'הזינו שם חדש לאירוע',
  ASK_DESCRIPTION: 'הזינו תיאור חדש לאירוע',
  ASK_DATETIME: 'הזינו תאריכים ושעות חדשים',
  get ASK_DATETIME_FOOTER() {
    return EVENT_ADD.ASK_DATETIME_FOOTER
  },
  get ASK_PRICE() {
    return EVENT_ADD.ASK_PRICE
  },
  get ASK_PRICE_FOOTER() {
    return EVENT_ADD.ASK_PRICE_FOOTER
  },
  PRICE_PARSE_FAIL_MESSAGE:
    'לא הצלחתי להבין מה מחיר האירוע, בבקשה הזן מחיר מחדש',
  PRICE_BACK_TO_MENU_BUTTON: { id: 'edit_price_back_to_menu', title: 'חזרה לתפריט' },
  get ASK_LINKS() {
    return EVENT_ADD.ASK_LINKS + '\n' + EVENT_ADD.ASK_LINKS_FOOTER
  },
  ASK_MEDIA: 'ניתן להעלות תמונות וסרטונים חדשים, נתחיל בתמונה/סרטון הראשיים',
  ASK_MEDIA_FOOTER: 'כל התמונות והסרטונים הקודמים יימחקו',
  MEDIA_CANCEL_BUTTON: { id: 'edit_media_cancel', title: 'לא משנה, התחרטתי' },
  FIELD_IDS: {
    EDIT_TITLE: 'edit_title',
    EDIT_DESCRIPTION: 'edit_description',
    EDIT_CATEGORIES: 'edit_categories',
    EDIT_LOCATION: 'edit_location',
    EDIT_NAV_LINKS: 'edit_nav_links',
    EDIT_DATETIME: 'edit_datetime',
    EDIT_PRICE: 'edit_price',
    EDIT_MEDIA: 'edit_media',
    EDIT_LINKS: 'edit_links',
    EDIT_DONE: 'edit_done',
  },
  MENU_ROWS: [
    { id: 'edit_title', title: 'שם האירוע' },
    { id: 'edit_description', title: 'תיאור האירוע' },
    { id: 'edit_categories', title: 'קטגוריות' },
    { id: 'edit_location', title: 'מיקום האירוע' },
    { id: 'edit_nav_links', title: 'לינקים לניווט לאירוע' },
    { id: 'edit_datetime', title: 'תאריכים ושעות' },
    { id: 'edit_price', title: 'מחיר' },
    { id: 'edit_media', title: 'תמונות וסרטונים' },
    { id: 'edit_links', title: 'לינקים וטלפונים' },
  ],
  CATEGORIES_CHOICE_BODY: 'אילו מהקטגוריות תרצה לשנות?',
  CATEGORIES_MAIN_BUTTON: { id: 'edit_cat_main', title: 'קטגוריה ראשית' },
  CATEGORIES_EXTRA_BUTTON: { id: 'edit_cat_extra', title: 'קטגוריות נוספות' },
  NAV_LINKS_ASK: 'הזינו לינק אחד או יותר לניווט למיקום האירוע (Waze, Google Maps)',
  NAV_LINKS_SUCCESS: 'לינקי הניווט עודכנו בהצלחה',
  SUCCESS_MESSAGES: {
    title: 'שם האירוע עודכן בהצלחה',
    description: 'תיאור האירוע עודכן בהצלחה',
    mainCategory: 'קטגוריה ראשית עודכנה בהצלחה',
    location: 'מיקום האירוע עודכן בהצלחה',
    navLinks: 'לינקי הניווט עודכנו בהצלחה',
    datetime: 'תאריכים ושעות עודכנו בהצלחה',
    price: 'מחיר עודכן בהצלחה',
    links: 'לינקים וטלפונים עודכנו בהצלחה',
    media: 'תמונות וסרטונים עודכנו בהצלחה',
  },
  SUCCESS_VALUE_EMPTY: 'ללא',
  PREVIEW_INTRO: 'אלו הפרטים המעודכנים:',
  APPROVE_BUTTON: { id: 'edit_preview_approve', title: 'אישור' },
  REEDIT_BUTTON: { id: 'edit_preview_reedit', title: 'עריכה מחדש' },
  BACK_BUTTON: { id: 'edit_preview_back', title: 'ביטול וחזרה' },
  HOW_TO_CONTINUE: 'העדכון נשמר.\nאיך תרצו להמשיך?',
  SUCCESS_DONE_BUTTON: { id: 'edit_success_done', title: 'סיימתי לעדכן' },
  SUCCESS_MORE_BUTTON: { id: 'edit_success_more', title: 'עדכון פרטים נוספים' },
  ACTIVE_EVENT_SUCCESS_BODY: 'כל הפרטים נשמרו בהצלחה.',
  ACTIVE_EVENT_VIEW_PROMPT: 'ניתן לצפות בדף האירוע ב-',
  ACTIVE_EVENT_SUCCESS_BUTTONS: [{ id: 'back_to_main', title: 'בחזרה לתפריט הראשי' }],
  SUCCESS_MORE_LOCATION_BUTTON: {
    id: 'edit_success_more_location',
    title: 'לעדכון נוסף במיקום',
  },
  SUCCESS_CHOOSE_BODY: 'בחר/י:',
  PATCH_ERROR: 'שגיאה בעדכון. נסו שוב.',
  FREE_LANG_UNCLEAR:
    'לא הצלחתי להבין מה בדיוק אתם מבקשים לעדכן, אשמח אם תכתבו בצורה ברורה יותר או תבחרו שדה מתוך הרשימה',
  FREE_LANG_CONFIRM_BODY: 'לאשר את העדכון או לבטל?',
  FREE_LANG_CONFIRM_BUTTON: { id: 'edit_freelang_confirm', title: 'מאשר/ת עדכון! 👍' },
  FREE_LANG_CANCEL_BUTTON: { id: 'edit_freelang_cancel', title: 'לא מאשר/ת עדכון 👎' },
  FREE_LANG_SUGGESTED_INTRO: 'אלו השינויים שזיהינו שברצונך לבצע:',
  FREE_LANG_CITY_OUTSIDE_REMOVED: (cityName) =>
    `היישוב ${cityName} לא נמצא באיזור הצפון (הוסר)`,
  FREE_LANG_SUCCESS_BODY: 'העדכון בוצע בהצלחה.',
  FREE_LANG_SUCCESS_PROMPT: 'איך תרצו להמשיך?',
  FREE_LANG_SUCCESS_MORE_BUTTON: {
    id: 'edit_freelang_success_more',
    title: 'לעדכון עוד פרטים',
  },
  FREE_LANG_SUCCESS_DONE_BUTTON: {
    id: 'edit_freelang_success_done',
    title: 'לסיום',
  },
  EXTRA_CANNOT_REMOVE_LAST: 'לא ניתן להסיר את הקטגוריה היחידה.',
  LOCATION_CITY_UNRECOGNIZED: 'לא הצלחנו לזהות יישוב. נסו שוב.',
  DATETIME_PARSE_FAILED: 'לא הצלחנו לזהות מתי מתקיים האירוע.',
  EXTRA_CATEGORIES_BODY: 'אלו הקטגוריות הנוספות אליהן משויך כרגע האירוע',
  EXTRA_CATEGORIES_NO_EXTRAS: 'אין קטגוריות נוספות.',
  EXTRA_ADD_BUTTON: { id: 'edit_extra_add', title: 'להוסיף קטגוריה' },
  EXTRA_REMOVE_BUTTON: { id: 'edit_extra_remove', title: 'להסיר קטגוריה' },
  EXTRA_BACK_BUTTON: { id: 'edit_extra_back', title: 'סיימתי לעדכן' },
  EXTRA_MAX_REACHED: (max) => `לא ניתן להוסיף יותר מ-${max} קטגוריות`,
  EXTRA_REMOVE_ASK: 'איזו קטגוריה להסיר?',
  EXTRA_NO_REMOVE: 'אין קטגוריות להסיר.',
  LOCATION_ASK_PLACE_NAME: 'הזינו את שם המקום בו יתקיים האירוע',
  LOCATION_ASK_CITY: 'הזינו יישוב חדש',
  LOCATION_ASK_REGION: 'בחרו אזור חדש',
  LOCATION_ASK_ADDRESS: 'הזינו כתובת חדשה',
  LOCATION_ASK_DETAILS: 'הזינו הוראות הגעה חדשות',
  CITY_OUTSIDE_REGION:
    'היישוב שציינת לא באיזור הצפון. אנא הזינו יישוב מתאים',
}

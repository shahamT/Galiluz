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

/**
 * Welcome message: reply buttons (quick replies, max 3, title max 20 chars).
 */
export const WELCOME_INTERACTIVE = {
  body: 'היי! 👋\nאני הבוט של אפליקציית *גלילו"ז* - Galiluz\n\nכנסו לאפליקציה כדי לגלות כל מה שקורה בצפון\n*גלילו"ז*🏔️ - https://galiluz.co.il\n\n*איך אפשר לעזור לכם?* 😊',
  buttons: [
    { id: 'discover', title: '?מה קורה בצפון 🏔️' },
    { id: 'publish', title: 'פרסום אירוע 📅' },
    { id: 'contact', title: 'צרו קשר 📩' },
  ],
}

/** Contact: message with wa.me link so user can open chat with the number */
export const CONTACT_MESSAGE =
  'לצורך יצירת קשר ניתן לשלוח הודעה ישירות:\nhttps://wa.me/972552835970'

/** Discover flow: ask category (list body) */
export const DISCOVER_ASK_CATEGORY = 'איזה אירועים את/ה מחפש/ת?'

/** Discover flow: ask time (body + footer + button ids) */
export const DISCOVER_ASK_TIME = {
  body: 'מתי?',
  footer: 'לצפייה בכל האירועים כנסו לgaliluz.co.il',
  buttons: [
    { id: 'today', title: 'היום' },
    { id: 'tomorrow', title: 'מחר' },
  ],
}

/** Discover flow: after sending events list — body + footer + 3 buttons */
export const DISCOVER_AFTER_LIST = {
  body: 'לא מצאת מה שחיפשת?',
  footer: 'לצפייה בכל האירועים כנסו ל galiluz.co.il',
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
  'בואו נפרסם אירוע חדש.\n🔹 בכל שלב ניתן לשלוח *ביטול* על מנת לחזור לתפריט הראשי\n🔹 לא ניתן לדלג על שדות חובה.'

export const EVENT_ADD_ASK_TITLE = 'שם האירוע (חובה)'

export const EVENT_ADD_ASK_DATETIME =
  'מתי האירוע קורה? (חובה)\nדוגמאות:\n27.2, 10 בערב\n5-7 בפברואר 8:00 עד 15:00\n10.2 - 13:00, 11.2 - 14:00'

export const EVENT_ADD_CATEGORY_INTRO = 'בואו נשייך את האירוע שלכם לקטגוריה ראשית'
export const EVENT_ADD_ASK_CATEGORY_GROUP = 'בחרו אחת מארבע הקבוצות הבאות'
export const EVENT_ADD_ASK_MAIN_CATEGORY = 'בחרו את הקטגוריה המתאימה ביותר לאירוע שלכם'
export const EVENT_ADD_CATEGORY_AI_NOTE = '_ה-AI כבר ישייך את האירוע לקטגוריות מתאימות נוספות._'
export const EVENT_ADD_CHANGE_GROUP_PROMPT = 'לא מתאים? אפשר לבחור קבוצה אחרת.'
export const EVENT_ADD_CHANGE_GROUP_BUTTON = { id: 'event_add_change_group', title: 'בחירת קבוצה אחרת' }

export const EVENT_ADD_LOCATION_INTRO = '*מיקום האירוע*\nאנא מלאו את פרטי המיקום'

export const EVENT_ADD_ASK_PLACE_NAME = 'שם המקום'
export const EVENT_ADD_SKIP_BUTTON = { id: 'event_add_skip', title: 'דלג' }

export const EVENT_ADD_ASK_CITY = 'יישוב (חובה)'

export const EVENT_ADD_ASK_ADDRESS = 'כתובת\n_עד שתי שורות_'

export const EVENT_ADD_ASK_LOCATION_NOTES =
  'הערות נוספות למיקום\n_לדוגמה - הכוונה של איך להגיע לכניסה_'

export const EVENT_ADD_ASK_WAZE_GMAPS =
  'ניתן להוסיף לינקים למיקום ספציפי או לניווט עם Waze.'

export const EVENT_ADD_ASK_PRICE =
  'מחיר האירוע\n_לדוגמה - 20 ש"ח / חינם_'

export const EVENT_ADD_ASK_DESCRIPTION =
  'תיאור מלא של האירוע (חובה)\n_ללא לינקים ומספרי טלפון, ניתן להוסיף לינקים וטלפונים בשדה הבא_'

export const EVENT_ADD_ASK_LINKS =
  'ניתן להוסיף לינקים וטלפונים\n_יש להוסיף תיאור לכל לינק, לדוגמה:_\n_לקניית כרטיסים: tickets.co.il_'

export const EVENT_ADD_ASK_MEDIA_FIRST =
  'הוספת תמונות וסרטונים (אופציונלי)\nשלח/י תמונה/סרטון ראשי'

export const EVENT_ADD_ASK_MEDIA_MORE = 'אפשר לשלוח עוד תמונה/סרטון'

export const EVENT_ADD_SUCCESS = 'תודה, האירוע נשמר'

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
export const EVENT_ADD_VALIDATE_ADDRESS = 'כתובת עד 100 תווים בשורה.'
export const EVENT_ADD_VALIDATE_LOCATION_NOTES = 'הערות מיקום עד 100 תווים.'
export const EVENT_ADD_VALIDATE_WAZE_GMAPS = 'קישורים עד 3000 תווים.'
export const EVENT_ADD_VALIDATE_PRICE = 'מחיר עד 50 תווים.'
export const EVENT_ADD_VALIDATE_DESCRIPTION = 'תיאור חייב להכיל בין 70 ל־3000 תווים.'
export const EVENT_ADD_VALIDATE_LINKS = 'לינקים עד 3000 תווים.'
export const EVENT_ADD_VALIDATE_MEDIA = 'נא לשלוח תמונה או סרטון, או ללחוץ דלג.'
export const EVENT_ADD_MEDIA_UPLOAD_FAILED =
  'שמירת התמונה/סרטון נכשלה (שירות לא זמין כרגע). נסה/י שוב או לחץ/י דלג.'

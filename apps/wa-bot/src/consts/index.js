/**
 * Log prefixes for wa-bot services
 */
export const LOG_PREFIXES = {
  MAIN: '[Main]',
  CONFIG: '[Config]',
  WEBHOOK: '[Webhook]',
  CLOUD_API: '[CloudAPI]',
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
  body: 'היי! 👋\nאני הבוט של אפליקציית גלילו"ז - Galiluz 🤖\n\nכנסו לאפליקציה כדי לגלות כל מה שקורה בצפון 🎉🏔️🎉\n\nגלילו"ז - https://galiluz.co.il\n\nאיך אפשר לעזור לכם? 😊',
  buttons: [
    { id: 'discover', title: '?מה קורה בצפון 🏔️' },
    { id: 'publish', title: 'פרסום אירוע 📅' },
  ],
}

/** Discover flow: ask category (list body) */
export const DISCOVER_ASK_CATEGORY = 'איזה סוג אירועים מעניינים אותך?'

/** Discover flow: ask time (body + footer + button ids) */
export const DISCOVER_ASK_TIME = {
  body: 'מתי?',
  footer: 'לצפייה בכל האירועים כנסו לgaliluz.co.il',
  buttons: [
    { id: 'today', title: 'היום' },
    { id: 'tomorrow', title: 'מחר' },
  ],
}

/** Discover flow: after sending events list — one button to search again */
export const DISCOVER_AFTER_LIST = {
  body: 'לא מצאת מה שחיפשת?\nלצפייה בכל האירועים כנסו ל galiluz.co.il',
  buttons: [{ id: 'discover', title: 'חפשו שוב' }],
}

/** Publish flow: placeholder when approved */
export const PUBLISH_REPLY = 'פרסום אירוע יגיע בקרוב! עד אז אפשר להיכנס ל־https://galiluz.co.il'

/** Publish flow: not registered — body + sign up / back to menu */
export const PUBLISH_NOT_REGISTERED = {
  body: 'היי, אני רואה שאתה לא רשום במערכת עדיין...\n\nכדי לפרסם אירועים בגלילו"ז, צריך להירשם (זה לוקח דקה).\nככה אנחנו מוודאים שרק אירועים אמיתיים ולגיטימיים עולים למערכת. ✅',
  buttons: [
    { id: 'publish_sign_me_up', title: 'יאללה תרשמו אותי' },
    { id: 'back_to_menu', title: 'חזרה לתפריט' },
  ],
}

/** Publish flow: registration steps (text prompts) */
export const PUBLISH_ASK_FULL_NAME = 'שם מלא'
export const PUBLISH_ASK_PUBLISHING_AS =
  'מטעם מי אתם מפרסמים? (יוזמה פרטית / שם העסק)'
export const PUBLISH_ASK_EVENT_TYPES =
  'סוג האירועים שאני מתכוון/ת לפרסם בגלילו"ז? (לדוגמה: ערבי שירה בבית העם)'

/** Publish flow: commitment step — body + buttons */
export const PUBLISH_ASK_COMMITMENT = {
  body: 'אני מתחייב/ת לפרסם אירועים בצפון בלבד ולציין פרטים מלאים ומהימנים של כל אירוע שאפרסם.',
  buttons: [
    { id: 'publish_commit_yes', title: 'מתחייב/ת' },
    { id: 'publish_commit_no', title: 'לא משנה' },
  ],
}

/** Publish flow: thank you after registration */
export const PUBLISH_THANK_YOU = {
  body: 'תודה שנרשמת כמפרסם/ת בגלילו"ז, אנו נעבור על הפרטים ונאשר אותך בהקדם. ברגע שתאושר/י תקבל/י מאיתנו הודעת וואטסאפ ותוכל/י לחזור לבוט ולהתחיל לפרסם אירועים!',
  buttons: [{ id: 'back_to_main', title: 'חזרה לתפריט הראשי' }],
}

/** Publish flow: user is pending approval */
export const PUBLISH_PENDING_MESSAGE =
  'אנחנו בודקים את הפרטים שהעברת. תקבל/י מאיתנו הודעת וואטסאפ ברגע שאושרת. עד אז אפשר להיכנס לאתר גלילו"ז.'

// --- Publisher approver flow (button titles max 20 chars) ---

/** Approver: body template for new publisher request. Use: name, publishingAs, eventTypes, waId */
export const APPROVER_REQUEST_BODY_TEMPLATE =
  'בקשת הרשמה כמפרסם/ת:\nשם מלא: {fullName}\nמטעם: {publishingAs}\nסוג אירועים: {eventTypes}\nמזהה וואטסאפ: {waId}'

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

/** To publisher: approved */
export const PUBLISHER_APPROVED = {
  body: 'אושרת כמפרסם/ת בגלילוז! כעת ניתן לפרסם אירועים. לחצו להלן לפרסום האירוע הראשון.',
  button: { id: 'publish', title: 'לפרסם אירוע ראשון' },
}

/** To publisher: rejected (append reason line when present) */
export const PUBLISHER_REJECTED_BODY =
  'הבקשה שלך לפרסום אירועים בגלילוז נדחתה. ניתן לבקש אישור מחדש במידה ורלוונטי.'
export const PUBLISHER_REJECTED_REASON_LINE = 'סיבת הדחייה: '

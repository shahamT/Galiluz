/**
 * Wa-bot constants. The bot has three publisher-facing concerns: DISCOVER (browse events),
 * CONTACT (a phone number), and directing publishers to the web PORTAL (login/register) — plus
 * the APPROVER flow (approve/reject a publisher, delete an event). The in-bot event
 * add/edit/delete and registration flows were retired, so their consts are gone.
 */

/** Log prefixes for wa-bot services. */
export const LOG_PREFIXES = {
  MAIN: '[Main]',
  CONFIG: '[Config]',
  WEBHOOK: '[Webhook]',
  CLOUD_API: '[CloudAPI]',
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
    footer: 'אפשר לכתוב לי בשפה חופשית או לבחור באחת האפשרויות:',
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
  FIRST_MESSAGE_FLOW_ACK:
    'היי! כאן הבוט של גלילו"ז 👋\nאני מעביר אתכם מייד לאן שביקשתם...',
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
}

// --- DISCOVER ---

export const DISCOVER = {
  ASK_CATEGORY: 'איזה אירועים את/ה מחפש/ת?',
  ASK_REGION: 'באיזה איזור?',
  REGION_BUTTONS: [
    { id: 'upper', title: 'אצבע הגליל' },
    { id: 'golan', title: 'צפון ומרכז רמת הגולן' },
    { id: 'center', title: 'הגליל העליון המרכזי' },
  ],
  ASK_TIME: {
    body: 'מתי?',
    footer: 'לצפייה בכל האירועים כנסו ל־ galiluz.co.il',
    buttons: [
      { id: 'today', title: 'היום' },
      { id: 'tomorrow', title: 'מחר' },
    ],
  },
  AFTER_LIST_FOOTER: 'לצפייה בכל האירועים כנסו ל־ galiluz.co.il',
  CATEGORY_LIST_BUTTON: 'בחר',
  CATEGORY_LIST_SECTION_TITLE: 'אפשרויות',
  CATEGORY_LIST_ALL_TITLE: 'הכל',
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

// --- APPROVER ---

export const APPROVER = {
  /** Fallback label when a publisher's name wasn't captured for the approver confirmation. */
  DEFAULT_PUBLISHER_LABEL: 'מפרסם',
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
  // Multi-approver conflict notices — shown to a late approver whose click is now irrelevant.
  ALREADY_APPROVED_BY: 'המפרסם *{fullName}* כבר אושר על ידי *{by}* ✅',
  ALREADY_REJECTED_BY: 'המפרסם *{fullName}* כבר נדחה על ידי *{by}* ❌',
  ALREADY_DELETED_BY: 'האירוע כבר נמחק על ידי *{by}* 🗑️',
  // Proactive notice pushed to the OTHER approvers when one of them acts.
  OTHER_APPROVED: '*{actor}* אישר/ה את המפרסם *{fullName}* ✅',
  OTHER_REJECTED: '*{actor}* דחה/תה את המפרסם *{fullName}* ❌',
  OTHER_DELETED: '*{actor}* מחק/ה את האירוע *{title}* 🗑️',
  EVENT_NOTIFICATION_HEADING: '*אירוע חדש פורסם במערכת*',
  DELETE_EVENT_BUTTON: { id: 'approver_delete_event', title: 'מחיקת אירוע 🗑️' },
  DELETE_EVENT_ASK: {
    body: 'שלח הסבר למפרסם? אם כן שלח את ההסבר בהודעה',
    buttons: [
      { id: 'approver_delete_no_reason', title: 'מחיקה ללא הסבר' },
      { id: 'approver_delete_cancel', title: 'ביטול' },
    ],
  },
  DELETE_EVENT_SUCCESS: 'האירוע נמחק בהצלחה ✅',
  DELETE_EVENT_CANCELLED: 'הפעולה בוטלה.',
}

// --- PUBLISHER (web-portal redirect) ---
// The approve/reject/event-deleted result notices moved to the WEB (server/utils/notifyPublisher.ts),
// sent via the wa-gateway — the Cloud API can't reach cold users without (unavailable) templates.

export const PUBLISHER = {
  // Single redirect shown for every publisher action (publish / update / delete an event, or
  // register) — the whole publisher lifecycle lives on the web portal now. {loginUrl}/{registerUrl}
  // are injected at send time (reply buttons can't carry URLs, so this is sent as text and
  // WhatsApp auto-links the URLs).
  PORTAL_REDIRECT: {
    body:
      'כבר נרשמתם כמפרסמים לגלילו"ז?\n' +
      'היכנסו עכשיו לאיזור האישי ופרסמו אירועים!\n' +
      'עוד לא נרשמתם? הירשמו כמפרסמים\n\n' +
      'כניסה לאיזור האישי 👇\n{loginUrl}\n\n' +
      'הצטרפות כמפרסמים 👇\n{registerUrl}',
  },
}

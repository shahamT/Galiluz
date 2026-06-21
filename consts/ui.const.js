// UI component constants

// Responsive breakpoint for mobile/desktop switch (in pixels)
// Breakpoints for responsive behavior
export const MOBILE_BREAKPOINT = 768 // Main mobile breakpoint for layouts and navigation
export const SMALL_MOBILE_BREAKPOINT = 560 // Breakpoint for compact mobile layouts (e.g., view toggle)
export const DAY_CELL_BREAKPOINT = 920 // Breakpoint for day cell chip display logic

// Welcome modal: localStorage key and expiry (days) for "first visit / every N days"
export const WELCOME_MODAL_STORAGE_KEY = 'galiluz-welcome-seen'
export const WELCOME_MODAL_EXPIRY_DAYS = 1
// Dev-only: expiry in hours for welcome modal (testing). Production uses WELCOME_MODAL_EXPIRY_DAYS.
export const WELCOME_MODAL_EXPIRY_HOURS_DEV = 12

// Welcome modal copy and region placeholders (step 0 = intro, step 1 = regions, step 2 = categories)
export const WELCOME_MODAL = {
  introSubtitle: 'המקום לגלות בו את כל מה שקורה עכשיו בצפון!',
  introLine1: 'אם אני לא טועה, זו הפעם הראשונה שלכם כאן!',
  introLine2: 'בואו נבין רגע איזה אירועים הכי רלוונטיים לכם',
  startButtonLabel: 'בואו נתחיל!',
  skipIntroLabel: 'ישר ללו"ז',
  skipIntroCaption: 'רוצים לקפוץ למים?',
  stepTitleRegion: 'בחירת איזור',
  stepTitleCategories: 'בחירת קטגוריות',
  regionsHeading: 'בחרו את האיזורים הרלוונטיים אליכם:',
  categoriesHeading: 'בחרו את הקטגוריות הרלוונטיות לכם:',
  skipLabel: 'דלגו',
  nextStepLabel: 'המשך/י',
  takeMeToScheduleLabel: 'קחו אותי ללו"ז',
}

export const WELCOME_REGION_OPTIONS = [
  { id: 'region1', label: 'כפתור 1' },
  { id: 'region2', label: 'כפתור 2' },
  { id: 'region3', label: 'כפתור 3' },
  { id: 'region4', label: 'כפתור 4' },
  { id: 'region5', label: 'כפתור 5' },
  { id: 'region6', label: 'כפתור 6' },
]

// Main menu (slide-out) labels
export const MAIN_MENU = {
  events: 'לו"ז אירועים',
  about: 'אודות',
  publishEvents: 'מארגנים אירועים בצפון?',
  termsOfService: 'תנאי שימוש',
  sendFeedback: 'שלחו פידבק',
  contactUs: 'צרו קשר',
  publisherLogin: 'כניסה למפרסמים',
  publisherRegisterCta: 'מארגנים אירוע בצפון? הירשמו כמפרסמים',
}

// Support contact (not bot) – for menu "צרו קשר" link
export const SUPPORT_WHATSAPP_NUMBER = '972559896278'
const MAIN_MENU_CONTACT_PREFILL = 'היי, אשמח לשאול שאלה בקשר לגלילו"ז'
export const MAIN_MENU_CONTACT_LINK = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(MAIN_MENU_CONTACT_PREFILL)}`

// Contact: Galiluz bot WhatsApp – number, CTA text, prefill message, and deep link
export const CONTACT_WHATSAPP_NUMBER = '972552835970'
export const CONTACT_WHATSAPP_CTA = 'גלילו"ז בוט'
export const CONTACT_WHATSAPP_BOT_DISPLAY = '0552835970'
const CONTACT_WHATSAPP_PREFILL = 'היי גלילו"ז בוט, מה קורה בצפון?'
export const CONTACT_WHATSAPP_LINK = `https://wa.me/${CONTACT_WHATSAPP_NUMBER}?text=${encodeURIComponent(CONTACT_WHATSAPP_PREFILL)}`
const PUBLISH_EVENT_PREFILL = 'היי, אני מעוניין/ת להוסיף אירוע לגלילו"ז'
export const PUBLISH_EVENT_WHATSAPP_LINK = `https://wa.me/${CONTACT_WHATSAPP_NUMBER}?text=${encodeURIComponent(PUBLISH_EVENT_PREFILL)}`
// Publisher registration deep link — the prefill MUST contain the bot's trigger
// phrase "רוצה להירשם כמפרסם" (apps/wa-bot routes that straight into registration).
const PUBLISHER_REGISTER_PREFILL = 'אני רוצה להירשם כמפרסם בגלילו"ז'
export const PUBLISHER_REGISTER_WHATSAPP_LINK = `https://wa.me/${CONTACT_WHATSAPP_NUMBER}?text=${encodeURIComponent(PUBLISHER_REGISTER_PREFILL)}`

// Website publisher-registration page (/register) — replaces the bot deep-link.
export const PUBLISHER_REGISTER_ROUTE = '/register'
export const REGISTER_PAGE = {
  title: 'הצטרפות כמפרסמים',
  subtitle1: 'הפרסום בגלילו"ז חינמי לחלוטין!',
  subtitle2: 'תהליך ההצטרפות קצרצר ואורך כדקה',
  step1Title: 'פרטים אישיים',
  step2Title: 'פרטי חשבון בגלילו"ז',
  fullNameLabel: 'שם מלא',
  emailLabel: 'אימייל',
  phoneLabel: 'מספר טלפון',
  accountNameLabel: 'שם החשבון',
  accountNameHint: 'בשם מי אתם מפרסמים? שם העסק או סוג האירועים',
  accountNamePlaceholder: "לדוגמה: פאב השכונה / יוזמה פרטית - ערבי שירה בציבור וכו'...",
  eventTypesLabel: 'אילו אירועים אתם מתכוונים לפרסם?',
  eventTypesHint: 'לדוגמה: \'הופעות ומסיבות\' / \'ערבי הקראת שירה\' וכו\'...',
  termsPrefix: 'אני מאשר/ת את ',
  termsLinkText: 'תנאי השימוש',
  nextButton: 'המשך',
  submitButton: 'שליחה ואימות טלפון',
  otpTitle: 'אימות מספר הטלפון',
  otpSubtitle: 'שלחנו קוד בן 6 ספרות לוואטסאפ של',
  verifyButton: 'אימות',
  changePhone: 'שינוי מספר',
  changePhoneTitle: 'שינוי מספר טלפון',
  changePhoneSubtitle: 'הזינו את המספר החדש ונשלח אליו קוד אימות חדש',
  changePhoneConfirm: 'שליחת קוד למספר החדש',
  changePhoneBack: 'חזרה למסך האימות',
  resend: 'שליחה חוזרת',
  successTitle: 'תודה שנרשמתם! 🎉',
  successBody: 'הפרטים התקבלו ואנחנו נעבור עליהם בהקדם. ברגע שתאושרו תקבלו הודעת וואטסאפ ותוכלו להתחיל לפרסם אירועים בגלילו"ז.',
  backToSchedule: 'בחזרה ללו"ז',
  errAlreadyApproved: 'המספר שהזנת כבר שייך למפרסם רשום.',
  loginLink: 'מעבר לכניסה',
  errPendingExists: 'כבר נשלחה בקשת הרשמה עם המספר הזה והיא ממתינה לאישור.',
}
const BOT_START_PREFILL = 'היי'
export const BOT_WHATSAPP_LINK = `https://wa.me/${CONTACT_WHATSAPP_NUMBER}?text=${encodeURIComponent(BOT_START_PREFILL)}`

// Legacy (kept for any other references; header uses CONTACT_WHATSAPP_* above)
export const CONTACT_WHATSAPP_DISPLAY = '055-989-6278'

export const MODAL_TEXT = {
  title: 'פרטי אירוע',
  close: 'סגור',
  noEventSelected: 'אירוע לא נמצא',
  categories: 'קטגוריות',
  location: 'מיקום',
  time: 'זמן',
  price: 'מחיר',
  description: 'תיאור',
  links: 'קישורים',
  contactPublisher: 'יצירת קשר עם המפרסם',
  addToCalendar: 'הוספה ליומן',
  navigateToEvent: 'ניווט לאירוע',
  share: 'שיתוף',
  unknownLocation: 'לא ידוע',
  disclaimer: 'פרטי האירוע מגיעים מהמפרסם ועוברים עיבוד ב AI - אין לנו אחריות על מהימנות ודיוק הפרטים.',
  locationMoreInfo: 'למידע נוסף',
}

export const CALENDAR_OPTIONS = [
  { id: 'google', label: 'Google Calendar', iconPath: '/icons/google-calendar.png' },
  { id: 'apple', label: 'Apple Calendar', iconPath: '/icons/apple-calendar.png' },
  { id: 'outlook', label: 'Outlook', iconPath: '/icons/outlook.png' },
  { id: 'ical', label: 'iCal', iconPath: '/icons/ical.svg' },
]

export const NAVIGATION_OPTIONS = [
  { id: 'waze', label: 'ניווט עם Waze', iconPath: '/icons/waze-icon.svg' },
  { id: 'gmaps', label: 'ניווט עם Google Maps', iconPath: '/icons/google-maps-icon.svg' },
]

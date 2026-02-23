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

/** Publish flow: placeholder reply */
export const PUBLISH_REPLY = 'פרסום אירוע יגיע בקרוב! עד אז אפשר להיכנס ל־https://galiluz.co.il'

// Route paths (single source of truth for calendar views)
export const ROUTE_MONTHLY_VIEW = '/monthly-view'
export const ROUTE_DAILY_VIEW = '/daily-view'

// Calendar grid constants
export const DAYS_PER_WEEK = 7

// Calendar display constants (same limits for desktop and mobile: 3 slots, 3rd is "+N" when more)
export const MAX_EVENTS_TO_DISPLAY = 3
export const MAX_REGULAR_CHIPS = 2
export const MAX_EVENTS_TO_DISPLAY_MOBILE = 3
export const MAX_REGULAR_CHIPS_MOBILE = 2
export const WEEKEND_DAYS = [5, 6] // Friday (5) and Saturday (6)
export const MORE_EVENTS_TEXT = (count) => `עוד ${count} אירועים...`

// Time filter: minutes in a day (24 * 60)
export const MINUTES_PER_DAY = 24 * 60

// Region filter keys (re-export from regions.const — single source of truth)
export { REGION_KEYS } from '~/consts/regions.const'

// localStorage key for persisting user filter preference (categories + time range)
export const FILTER_PREFERENCE_STORAGE_KEY = 'galiluz-calendar-filters'

// Daily carousel configuration
export const DAILY_CAROUSEL_DAYS_RANGE = 4 // Number of days on each side of the center date (total: 2*range + 1 = 9 days)

// Time filter slider step (in minutes)
export const TIME_SLIDER_STEP = 15

// Predefined time filter presets (id, label, startMinutes, endMinutes, icon for UiIcon)
// "all" must be first - represents no time filter, selected when 0 to MINUTES_PER_DAY
export const TIME_FILTER_PRESETS = [
  { id: 'all', label: 'כל שעה', startMinutes: 0, endMinutes: MINUTES_PER_DAY, icon: 'schedule' },
  { id: 'morning', label: 'בוקר', startMinutes: 6 * 60, endMinutes: 12 * 60, icon: 'partly_cloudy_day' },
  { id: 'noon', label: 'צהריים', startMinutes: 11 * 60, endMinutes: 14 * 60, icon: 'wb_sunny' },
  { id: 'afternoon', label: 'אחר הצהריים', startMinutes: 12 * 60, endMinutes: 18 * 60, icon: 'wb_twilight' },
  { id: 'evening', label: 'ערב', startMinutes: 17 * 60, endMinutes: 21 * 60, icon: 'nights_stay' },
  { id: 'night', label: 'לילה', startMinutes: 20 * 60, endMinutes: 24 * 60, icon: 'dark_mode' },
]

// UI text constants
export const UI_TEXT = {
  loading: 'טוען אירועים...',
  error: 'שגיאה בטעינת אירועים',
  backToMonthly: 'חזרה ללו"ז חודשי',
  noEvents: 'אין אירועים',
  notFound: 'הדף המבוקש לא נמצא',
  eventsCount: (count) => `${count} אירועים`,
  viewMonthly: 'חודשי',
  viewDaily: 'יומי',
  filterButtonLabel: 'סינון',
  categoriesFilter: 'קטגוריות',
  categoriesFilterTitle: 'קטגוריות',
  regionsFilter: 'אזורים',
  regionsCountLabel: (count) => `${count} אזורים`,
  hoursFilter: 'שעות',
  hoursFilterAll: 'כל שעה',
  resetFilter: 'ניקוי',
  filterDone: 'סיום',
  categoriesCountLabel: (count) => `${count} קטגוריות`,
}

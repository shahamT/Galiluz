/**
 * Event categories constants — single source of truth
 * Shared by Nuxt server API and wa-listener
 */
export const EVENT_CATEGORIES = {
  party: {
    label: 'מסיבה / ריקוד',
    color: '#EF4444',
  },
  show: {
    label: 'הופעה',
    color: '#8B5CF6',
  },
  lecture: {
    label: 'הרצאה',
    color: '#3B82F6',
  },
  nature: {
    label: 'טיול / סיור בטבע',
    color: '#10B981',
  },
  volunteering: {
    label: 'התנדבות',
    color: '#06B6D4',
  },
  religion: {
    label: 'דת',
    color: '#6B7280',
  },
  food: {
    label: 'אוכל',
    color: '#F59E0B',
  },
  sport: {
    label: 'ספורט ותנועה',
    color: '#DC2626',
  },
  fair: {
    label: 'יריד',
    color: '#F97316',
  },
  second_hand: {
    label: 'יד שנייה',
    color: '#78716C',
  },
  art: {
    label: 'אמנות ויצירה',
    color: '#A855F7',
  },
  music: {
    label: 'מוזיקה',
    color: '#EC4899',
  },
  community_meetup: {
    label: 'מפגש קהילתי',
    color: '#0EA5E9',
  },
  jam: {
    label: "ג'אם",
    color: '#F43F5E',
  },
  course: {
    label: 'חוג',
    color: '#6366F1',
  },
  festival: {
    label: 'פסטיבל',
    color: '#EAB308',
  },
  workshop: {
    label: 'סדנה',
    color: '#14B8A6',
  },
  health: {
    label: 'בריאות',
    color: '#22C55E',
  },
  kids: {
    label: 'ילדים',
    color: '#FBBF24',
  },
  politics: {
    label: 'פוליטיקה',
    color: '#4338CA',
  },
  open_day: {
    label: 'יום פתוח',
    color: '#84CC16',
  },
  studies: {
    label: 'לימודים',
    color: '#2563EB',
  },
  technology: {
    label: 'טכנולוגיה',
    color: '#0EA5E9',
  },
  // Temporary, time-windowed category (selectable only within the dates below).
  // Stays in the catalog permanently so tagged events keep their label/color forever.
  mundial: {
    label: 'מונדיאל ⚽',
    color: '#15803D',
    availableFrom: '2026-06-11',
    availableTo: '2026-07-20',
  },
}

/** Id used in filter UI and wa-bot for "all categories" */
export const CATEGORY_ALL_ID = 'all'

/**
 * Category groups for filter UI — group label and ordered category IDs
 */
export const CATEGORY_GROUPS = [
  {
    id: 'music_nature_movement',
    label: 'מוזיקה, טבע ותנועה',
    categoryIds: ['party', 'show', 'jam', 'festival', 'nature', 'sport', 'music', 'mundial'],
  },
  {
    id: 'food_art_shopping',
    label: 'אוכל, אמנות ושופינג',
    categoryIds: ['food', 'second_hand', 'fair', 'art'],
  },
  {
    id: 'community',
    label: 'קהילה',
    categoryIds: ['community_meetup', 'volunteering', 'religion', 'politics', 'kids'],
  },
  {
    id: 'workshops_studies',
    label: 'סדנאות ולימודים',
    categoryIds: ['lecture', 'workshop', 'course', 'studies', 'technology', 'open_day', 'health'],
  },
]

/**
 * Returns an array of category objects with id and label
 * @returns {Array<{id: string, label: string}>} Array of category objects
 */
export function getCategoriesList() {
  return Object.entries(EVENT_CATEGORIES).map(([id, category]) => ({
    id,
    label: category.label,
  }))
}

/**
 * Whether a category is currently selectable. Categories without an
 * availableFrom/availableTo window are always available; time-windowed ones
 * (e.g. mundial) are gated by the YYYY-MM-DD `todayYMD` the caller passes.
 * The catalog still keeps every category for display — this only affects selection UIs.
 * @param {{availableFrom?: string, availableTo?: string}} category
 * @param {string} todayYMD - today's date as YYYY-MM-DD
 * @returns {boolean}
 */
export function isCategoryAvailable(category, todayYMD) {
  if (!category) return false
  if (category.availableFrom && todayYMD < category.availableFrom) return false
  if (category.availableTo && todayYMD > category.availableTo) return false
  return true
}

/**
 * Category groups with only the currently-selectable categories in each,
 * dropping any group left empty. Use in selection UIs (publisher picker, public filter).
 * @param {string} todayYMD - today's date as YYYY-MM-DD
 */
export function getAvailableCategoryGroups(todayYMD) {
  return CATEGORY_GROUPS
    .map((group) => ({
      ...group,
      categoryIds: group.categoryIds.filter((id) => isCategoryAvailable(EVENT_CATEGORIES[id], todayYMD)),
    }))
    .filter((group) => group.categoryIds.length > 0)
}

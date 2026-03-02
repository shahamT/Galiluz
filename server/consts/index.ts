/**
 * Server-side constants
 */

/**
 * Route path for events daily view. Must stay in sync with consts/calendar.const.js ROUTE_EVENTS_DAILY_VIEW.
 * Defined here to avoid server importing calendar.const (which uses ~ alias not resolved in Nitro).
 */
export const ROUTE_EVENTS_DAILY_VIEW = '/events/daily-view'

/**
 * Default limits for message queries
 */
export const MESSAGES_DEFAULT = 200
export const MESSAGES_MAX = 500

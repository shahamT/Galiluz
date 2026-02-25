/**
 * Shared event edit flow: menu payload and field ids.
 * Used by event-add "עריכת פרטים" and future update-event flow.
 * Per-field logic (validation, patch, ask messages) lives in the calling flow (eventAddFlow.js) for now.
 */
import {
  EVENT_EDIT_MENU_BODY,
  EVENT_EDIT_MENU_FOOTER,
  EVENT_EDIT_MENU_ROWS,
  EVENT_EDIT_DONE_ROW,
  EVENT_EDIT_LOCATION_MENU_BODY,
  EVENT_EDIT_LOCATION_MENU_FOOTER,
  EVENT_EDIT_LOCATION_BACK_ROW,
  EVENT_EDIT_LOCATION_DONE_ROW,
  EVENT_EDIT_LOCATION_FIELD_ROWS,
} from '../consts/index.js'

/** Row id for "סיימתי לעדכן פרטים" — exit edit flow. */
export const EDIT_DONE_ID = 'edit_done'

/** All edit menu row ids (for validation): done + field rows. */
export const EDIT_FIELD_IDS = new Set([
  EVENT_EDIT_DONE_ROW.id,
  ...EVENT_EDIT_MENU_ROWS.map((r) => r.id),
])

/**
 * Build interactive list payload for the edit menu (אילו פרטים תרצו לשנות?).
 * Two sections: first "סיימתי לעדכן פרטים", second all field options.
 * Reusable by event-add and update-event flows.
 * @returns {{ body: string, footer: string, button: string, sections: Array<{ title: string, rows: Array<{ id: string, title: string }> }> }}
 */
export function buildEditMenuListPayload() {
  return {
    body: EVENT_EDIT_MENU_BODY,
    footer: EVENT_EDIT_MENU_FOOTER,
    button: 'בחר',
    sections: [
      {
        title: 'סיום עריכה',
        rows: [EVENT_EDIT_DONE_ROW],
      },
      {
        title: 'עריכת שדות',
        rows: EVENT_EDIT_MENU_ROWS,
      },
    ],
  }
}

/**
 * Build interactive list payload for the location edit sub-menu.
 * Two sections: back/done, then the six location fields.
 * @returns {{ body: string, footer: string, button: string, sections: Array<{ title: string, rows: Array<{ id: string, title: string }> }> }}
 */
export function buildLocationEditMenuPayload() {
  return {
    body: EVENT_EDIT_LOCATION_MENU_BODY,
    footer: EVENT_EDIT_LOCATION_MENU_FOOTER,
    button: 'בחר',
    sections: [
      {
        title: 'ניווט',
        rows: [EVENT_EDIT_LOCATION_BACK_ROW, EVENT_EDIT_LOCATION_DONE_ROW],
      },
      {
        title: 'שדות מיקום',
        rows: EVENT_EDIT_LOCATION_FIELD_ROWS,
      },
    ],
  }
}

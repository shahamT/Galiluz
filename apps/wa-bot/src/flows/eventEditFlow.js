/**
 * Shared event edit flow: menu payload and field ids.
 * Used by event-add "עריכת פרטים" and future update-event flow.
 * Per-field logic (validation, patch, ask messages) lives in the calling flow (eventAddFlow.js) for now.
 */
import { EVENT_EDIT, EVENT_LIST } from '../consts/index.js'

/** Row id for "סיימתי לעדכן פרטים" — exit edit flow. */
export const EDIT_DONE_ID = 'edit_done'

/** All edit menu row ids (for validation): done + field rows. */
export const EDIT_FIELD_IDS = new Set([
  EVENT_EDIT.DONE_ROW.id,
  ...EVENT_EDIT.MENU_ROWS.map((r) => r.id),
])

/**
 * Build interactive list payload for the edit menu (אילו פרטים תרצו לשנות?).
 * Two sections: first "סיימתי לעדכן פרטים", second all field options.
 * Reusable by event-add and update-event flows.
 * @returns {{ body: string, footer: string, button: string, sections: Array<{ title: string, rows: Array<{ id: string, title: string }> }> }}
 */
export function buildEditMenuListPayload() {
  return {
    body: EVENT_EDIT.MENU_BODY,
    footer: EVENT_EDIT.MENU_FOOTER,
    button: EVENT_EDIT.LIST_BUTTON,
    sections: [
      {
        title: EVENT_EDIT.SECTION_DONE,
        rows: [EVENT_EDIT.DONE_ROW],
      },
      {
        title: EVENT_EDIT.SECTION_FIELDS,
        rows: EVENT_EDIT.MENU_ROWS,
      },
    ],
  }
}

/**
 * Build interactive list payload for the edit menu first message (free-language intro + same list).
 * Use when user first clicks "עריכת פרטים"; use buildEditMenuListPayload() for re-displays.
 * @returns {{ body: string, footer: string, button: string, sections: Array<{ title: string, rows: Array<{ id: string, title: string }> }> }}
 */
export function buildEditMenuFirstMessagePayload() {
  return {
    body: EVENT_EDIT.MENU_FIRST_BODY,
    footer: EVENT_EDIT.MENU_FIRST_FOOTER,
    button: EVENT_EDIT.LIST_BUTTON,
    sections: [
      {
        title: EVENT_EDIT.SECTION_DONE,
        rows: [EVENT_EDIT.DONE_ROW],
      },
      {
        title: EVENT_EDIT.SECTION_FIELDS,
        rows: EVENT_EDIT.MENU_ROWS,
      },
    ],
  }
}

/**
 * Build interactive list payload for the edit menu when free-language was unclear.
 * Same list as edit menu, but body = unclear message and footer = first message footer.
 * @param {string} body - Unclear message (e.g. EVENT_EDIT.FREE_LANG_UNCLEAR or LLM message)
 * @returns {{ body: string, footer: string, button: string, sections: Array<{ title: string, rows: Array<{ id: string, title: string }> }> }}
 */
export function buildEditMenuUnclearPayload(body) {
  return {
    body: typeof body === 'string' ? body : EVENT_EDIT.MENU_BODY,
    footer: EVENT_EDIT.MENU_FIRST_FOOTER,
    button: EVENT_EDIT.LIST_BUTTON,
    sections: [
      {
        title: EVENT_EDIT.SECTION_DONE,
        rows: [EVENT_EDIT.DONE_ROW],
      },
      {
        title: EVENT_EDIT.SECTION_FIELDS,
        rows: EVENT_EDIT.MENU_ROWS,
      },
    ],
  }
}

/**
 * Crop event title for list row (WhatsApp row title limit).
 * @param {string} title
 * @param {number} maxLen
 * @returns {string}
 */
function cropEventTitleForRow(title, maxLen = EVENT_LIST.ROW_TITLE_MAX) {
  const s = typeof title === 'string' ? title.trim() : ''
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen - 1) + '…'
}

/**
 * Build interactive list payload for publisher event selection (update or delete flow).
 * Shows up to 10 event rows; if more events exist, shows 9 + "אירועים נוספים" row (id = event_list_more_${nextOffset}).
 * @param {Array<{ id: string, title: string }>} events - Full sorted list
 * @param {number} offset - Current page start index
 * @param {string} bodyText - List body (e.g. EVENT_UPDATE_SELECT_BODY)
 * @param {string} rowIdPrefix - Prefix for event row ids (e.g. 'ev_up_' or 'ev_del_')
 * @returns {{ body: string, button: string, sections: Array<{ title: string, rows: Array<{ id: string, title: string }> }> }}
 */
export function buildPublisherEventListPayload(events, offset, bodyText, rowIdPrefix) {
  const list = Array.isArray(events) ? events : []
  const off = Math.max(0, Number(offset) || 0)
  const hasMore = list.length > off + 10
  const pageSize = hasMore ? 9 : 10
  const page = list.slice(off, off + pageSize)
  const rows = page.map((ev) => ({
    id: rowIdPrefix + ev.id,
    title: cropEventTitleForRow(ev.title),
  }))
  if (hasMore) {
    const nextOffset = off + 9
    rows.push({ id: `event_list_more_${nextOffset}`, title: EVENT_LIST.MORE_ROW_TITLE })
  }
  return {
    body: typeof bodyText === 'string' ? bodyText : 'איזה אירוע?',
    button: EVENT_LIST.SELECT_EVENT_LIST_BUTTON,
    sections: [{ title: 'אירועים', rows }],
  }
}

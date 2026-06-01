const VISITOR_ID_KEY = 'galiluz_visitor_id'

function getVisitorId() {
  if (!import.meta.client) return ''
  let id = localStorage.getItem(VISITOR_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(VISITOR_ID_KEY, id)
  }
  return id
}

export function useEventTracking() {
  const uiStore = useUiStore()

  async function track(eventId, action, extra = {}) {
    if (!eventId || !import.meta.client) return
    // Attach occurrence date for view/calendar actions
    const occurrenceDate = uiStore.selectedOccurrenceDate
    const body = {
      action,
      visitorId: getVisitorId(),
      ...(occurrenceDate && (action === 'view' || action === 'calendar') ? { occurrenceDate } : {}),
      ...extra,
    }
    $fetch(`/api/events/${eventId}/interact`, {
      method: 'POST',
      body,
    }).catch(() => {})
  }

  return { track }
}

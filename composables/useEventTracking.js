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
  async function track(eventId, action, extra = {}) {
    if (!eventId || !import.meta.client) return
    $fetch(`/api/events/${eventId}/interact`, {
      method: 'POST',
      body: { action, visitorId: getVisitorId(), ...extra },
    }).catch(() => {}) // fire-and-forget, never block UI
  }

  return { track }
}

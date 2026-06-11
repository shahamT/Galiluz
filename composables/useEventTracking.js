const VISITOR_ID_KEY = 'galiluz_visitor_id'
const PENDING_KEY = 'galiluz_pending_interactions'
const SEEN_VIEWS_KEY = 'galiluz_seen_views'
const MAX_PENDING = 20

function getVisitorId() {
  if (!import.meta.client) return ''
  let id = localStorage.getItem(VISITOR_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(VISITOR_ID_KEY, id)
  }
  return id
}

function readJson(key) {
  try { return JSON.parse(sessionStorage.getItem(key)) || [] } catch { return [] }
}

function writeJson(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full/blocked — drop */ }
}

/** Views already counted this session (eventId:occurrenceDate) — repeat modal opens don't inflate stats. */
function alreadyViewed(viewKey) {
  return readJson(SEEN_VIEWS_KEY).includes(viewKey)
}

function markViewed(viewKey) {
  const seen = readJson(SEEN_VIEWS_KEY)
  if (!seen.includes(viewKey)) writeJson(SEEN_VIEWS_KEY, [...seen, viewKey].slice(-200))
}

function send(eventId, body) {
  return $fetch(`/api/events/${eventId}/interact`, { method: 'POST', body })
}

/** Retry interactions that failed on flaky networks; each item gets max 2 attempts total. */
async function flushPending() {
  const pending = readJson(PENDING_KEY)
  if (!pending.length) return
  writeJson(PENDING_KEY, [])
  for (const item of pending) {
    try {
      await send(item.eventId, item.body)
    } catch {
      if ((item.attempts || 1) < 2) {
        const requeued = readJson(PENDING_KEY)
        writeJson(PENDING_KEY, [...requeued, { ...item, attempts: (item.attempts || 1) + 1 }].slice(-MAX_PENDING))
      }
    }
  }
}

export function useEventTracking() {
  const uiStore = useUiStore()

  async function track(eventId, action, extra = {}) {
    if (!eventId || !import.meta.client) return
    // Attach occurrence date for view/calendar actions
    const occurrenceDate = uiStore.selectedOccurrenceDate

    // Dedupe views per session so reopening the same event doesn't inflate stats
    if (action === 'view') {
      const viewKey = `${eventId}:${occurrenceDate || ''}`
      if (alreadyViewed(viewKey)) return
      markViewed(viewKey)
    }

    const body = {
      action,
      visitorId: getVisitorId(),
      ...(occurrenceDate && (action === 'view' || action === 'calendar') ? { occurrenceDate } : {}),
      ...extra,
    }

    try {
      await send(eventId, body)
      flushPending().catch(() => {})
    } catch {
      // Queue for retry on the next successful interaction (flaky mobile networks)
      const pending = readJson(PENDING_KEY)
      writeJson(PENDING_KEY, [...pending, { eventId, body, attempts: 1 }].slice(-MAX_PENDING))
    }
  }

  return { track }
}

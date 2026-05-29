const pendingByEventId = new Map()

export const approverEventNotifications = {
  store(eventId, { publisherPhone, eventTitle }) {
    pendingByEventId.set(String(eventId), { publisherPhone, eventTitle })
  },
  get(eventId) {
    return pendingByEventId.get(String(eventId)) ?? null
  },
  remove(eventId) {
    pendingByEventId.delete(String(eventId))
  },
}

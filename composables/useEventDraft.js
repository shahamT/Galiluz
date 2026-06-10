const DRAFT_KEYS = {
  add: 'galiluz-event-draft-add',
  edit: (id) => `galiluz-event-draft-edit-${id}`,
}

export function useEventDraft() {
  function saveDraft(mode, eventId, form, existingMedia) {
    const key = mode === 'edit' ? DRAFT_KEYS.edit(eventId) : DRAFT_KEYS.add
    const draft = {
      mode,
      eventId,
      savedAt: new Date().toISOString(),
      form: { ...toRaw(form), media: [] },
      existingMedia: toRaw(existingMedia),
    }
    try { localStorage.setItem(key, JSON.stringify(draft)) } catch {}
    return key
  }

  function loadDraft(key) {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }

  function clearDraft(key) {
    try { localStorage.removeItem(key) } catch {}
  }

  return { saveDraft, loadDraft, clearDraft }
}

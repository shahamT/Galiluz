/**
 * UI state store (modals, overlays).
 * Manages event modal state with URL synchronization for shareable links.
 */
export const useUiStore = defineStore('ui', () => {
  const route = useRoute()
  const router = useRouter()

  const isEventModalShowing = ref(false)
  const isWelcomeModalShowing = ref(false)
  /** True if welcome modal was shown at any point this session (onboarding flow). Used to avoid showing filter notify after first-time preference selection. */
  const welcomeModalShownThisSession = ref(false)
  const selectedEventId = ref(null)
  const requestFilterPopupOpen = ref(false)

  function setWelcomeModalShowing(shown) {
    isWelcomeModalShowing.value = shown
    if (shown) {
      welcomeModalShownThisSession.value = true
    }
  }

  function requestOpenFilterPopup() {
    requestFilterPopupOpen.value = true
  }

  function openEventModal(eventId) {
    selectedEventId.value = eventId
    isEventModalShowing.value = true

    if (import.meta.client) {
      router.push({
        query: { ...route.query, event: eventId }
      })
    }
  }

  function closeEventModal() {
    isEventModalShowing.value = false
    selectedEventId.value = null

    if (import.meta.client) {
      const query = { ...route.query }
      delete query.event
      router.push({ query })
    }
  }

  function initializeModalFromUrl() {
    if (import.meta.client && route.query.event) {
      selectedEventId.value = route.query.event
      isEventModalShowing.value = true
    }
  }

  // Watch for URL changes (browser back/forward)
  watch(() => route.query.event, (newEventId) => {
    // Only update state if it differs from current state
    if (newEventId && newEventId !== selectedEventId.value) {
      selectedEventId.value = newEventId
      isEventModalShowing.value = true
    } else if (!newEventId && isEventModalShowing.value) {
      isEventModalShowing.value = false
      selectedEventId.value = null
    }
  })

  return {
    isEventModalShowing,
    isWelcomeModalShowing,
    welcomeModalShownThisSession,
    selectedEventId,
    requestFilterPopupOpen,
    openEventModal,
    closeEventModal,
    setWelcomeModalShowing,
    initializeModalFromUrl,
    requestOpenFilterPopup,
  }
})

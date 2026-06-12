# Composables

All composables here are auto-imported (`imports.dirs` in [nuxt.config.ts](../nuxt.config.ts)) — never add manual imports. Flows, data-fetching architecture, and the carousel contract live in [docs/FRONTEND.md](../docs/FRONTEND.md).

Rule that prevents real bugs: use `useAuthFetch` for **all** `/api/publisher/**` calls; raw `$fetch()` has no 401 handling — catch manually.

| Composable | Purpose |
|------------|---------|
| [useActiveFilterCount](useActiveFilterCount.js) | `activeFilterCount` / `hasAnyFilter` computed from the calendar store's filters |
| [useAuth](useAuth.js) | OTP auth flow: `sendOtp`, `verifyOtp`, `logout`, `checkAuth` against `/api/auth/*`; updates the auth store |
| [useAuthFetch](useAuthFetch.js) | `useFetch` wrapper for publisher APIs: `server: false` + single-flight 401 → logout + redirect to `/login` |
| [useCalendarNavigation](useCalendarNavigation.js) | Route + store navigation helpers: `navigateToMonth/Day`, `goToPrev/NextDay`, `switchToDailyView`, `navigateToMonthInDailyView` |
| [useCalendarPageInit](useCalendarPageInit.js) | `runPageInit()` for both calendar pages' `onMounted`: URL state init → URL sync watchers → modal-from-URL |
| [useCalendarViewData](useCalendarViewData.js) | Events + categories via plugin DI (`$eventsData`/`$categoriesData`, direct fallback on SSR); merged `isLoading`/`isError`, passes `ensureMonthLoaded` |
| [useCalendarViewNav](useCalendarViewNav.js) | CalendarViewNav component logic: month-year picker and filter popup state, refs, handlers |
| [useCategories](useCategories.js) | `useFetch('/api/categories')`, client-only (`server: false`) |
| [useEventDraft](useEventDraft.js) | localStorage drafts for the publisher event form: `saveDraft`/`loadDraft`/`clearDraft` (survive logout) |
| [useEventFilters](useEventFilters.js) | `getFilteredEventsForMonth/ForDate/ByDate` — applies store category/region/time filters to flattened events |
| [useEventMetaForSeo](useEventMetaForSeo.js) | SSR fetch of event title/description/image for og: tags when the route has `?event=` |
| [useEventModalData](useEventModalData.js) | Fetches + formats the selected event for EventModal (location, date/time, price, media, links) |
| [useEventModalGallery](useEventModalGallery.js) | EventModal gallery layout: visible thumb count, overflow "+N", preload state |
| [useEventModalImagePopup](useEventModalImagePopup.js) | EventModal lightbox state: open/close + current image index |
| [useEventModalShare](useEventModalShare.js) | Web Share API capability check + share handler (captures analytics + interaction) |
| [useEvents](useEvents.js) | Rolling-window events feed: `windowEnd` useState (route-aware init), `?to=` query, SSR `X-API-Key` + payload cache, occurrence flattening, expansion-only `ensureMonthLoaded` |
| [useEventTracking](useEventTracking.js) | `track(eventId, action)` → `/api/events/:id/interact`; per-session view dedupe + sessionStorage retry queue (max 2 attempts) |
| [useFilterSummary](useFilterSummary.js) | Formatted active-filter summary string for the filter button and notify bar |
| [useIconFontReady](useIconFontReady.js) | Material Symbols font-load flag so icons don't flash literal glyph names |
| [useInstallPrompt](useInstallPrompt.js) | Shared PWA install state: `canInstall`, `isIOS`, `isInstalled`, `showInstructions`, `triggerInstall` |
| [usePosthog](usePosthog.js) | `capture`/`identify` wrappers around `$posthog`; no-op when PostHog isn't initialized |
| [useScreenWidth](useScreenWidth.js) | Reactive `max-width` media query (default < 768px) via VueUse |
| [useUrlState](useUrlState.js) | URL ↔ calendar store sync (`?year/month` or `?date` + filter params) with localStorage filter preference fallback |

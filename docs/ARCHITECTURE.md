# Galiluz – Frontend architecture

High-level map of the Nuxt frontend: main flows, where they start, and which files they touch.

## Directory layout

- **pages/** – `index` (redirect), `monthly-view`, `daily-view`, `[...slug]` (404). **Publisher portal:** `publisher/index` (redirect → dashboard), `publisher/dashboard`, `publisher/events/index`, `publisher/events/[id]`, `publisher/events/edit/[id]`, `publisher/login`.
- **components/** – `layout/` (AppShell, AppHeader, ProtectedShell), `controls/` (CalendarViewNav, CalendarViewHeader), `monthly/`, `daily/`, `ui/` (EventModal sub-parts, filters, pickers). Root: EventModal, CalendarViewContent. **Publisher:** `publisher/` (EventFormModal, EventPreview, EventListItem, EventsSearchBar, EventDeleteModal, NavTabs, Dashboard\*, etc.). **Form:** `form/` (RichTextEditor, CityPicker, OccurrenceRow, MediaUpload, LinkRow, CategorySelectDropdown, RegionSelectModal, FormField, etc.).
- **composables/** – Data: useCalendarViewData, useEvents, useCategories. URL/state: useUrlState, useCalendarNavigation, useCalendarPageInit. Filtering: useEventFilters. Modal: useEventModalData, useEventModalGallery, useEventModalShare. Auth: **useAuthFetch** (authenticated fetch wrapper). Utils: useScreenWidth, useIconFontReady, usePosthog.
- **stores/** – calendar.store (filters, currentDate, lastDailyViewDate), ui.store (event modal + URL sync), **auth.store** (user, authReady, isLoggedIn, isManager — publisher session state).
- **utils/** – events.service, events.helpers, calendar.helpers, calendar-display.helpers, date.helpers, validation.helpers, navigation.service, calendar.service, media.helpers, israelDate, logger.
- **consts/** – events.const (EVENT_CATEGORIES, CATEGORY_GROUPS), calendar.const, ui.const, regions.const (CITIES, REGIONS).
- **plugins/** – data-init.client (fetches events + categories once, provides to app).
- **server/api/publisher/** – `dashboard.get`, `events.get`, `events.post`, `event/[id].get`, `event/[id].patch`, `event/[id].delete`, `media.post`.
- **server/utils/** – requirePublisherAuth, sanitizeEventFields, convertOccurrenceTimes, eventValidation, eventLogs.service, cloudinary, mongodb.

---

## Flow 1: Calendar view and URL (month/daily, date, view toggle)

1. **View toggle** – User clicks month/day in CalendarViewNav → emit to CalendarViewHeader → monthly-view/daily-view handle: monthly calls `switchToDailyView(currentDate)`, daily calls `navigateToMonth(headerDate)` (useCalendarNavigation).
2. **useCalendarNavigation** – `switchToDailyView` / `navigateToDay` / `navigateToMonth` use router + calendarStore (setCurrentDate, lastDailyViewDate).
3. **URL sync** – useCalendarPageInit({ syncMonth }) returns runPageInit(), which runs initializeFromUrl(), startUrlSync(), and uiStore.initializeModalFromUrl(). Both calendar pages call runPageInit() in onMounted (daily-view after validating/fixing date query and nextTick). Route paths: consts/calendar.const (ROUTE_MONTHLY_VIEW, ROUTE_DAILY_VIEW).
4. **Carousels** – monthly-view passes visibleMonths, currentDate, filteredEvents, categories → MonthCarousel → MonthCalendar → DayCell. daily-view passes visibleDays, eventsByDate, dateParam, categories → KanbanCarousel → KanbanColumn → KanbanEventCard. Swipe/change → emit → page updates store and/or navigates.

**Files:** CalendarViewNav, CalendarViewHeader, monthly-view, daily-view, useCalendarNavigation, useUrlState, calendar.store, MonthCarousel, MonthCalendar, DayCell, KanbanCarousel, KanbanColumn, date.helpers, validation.helpers.

---

## Flow 2: Events data (API → monthly grid & daily columns)

1. **Fetch** – Plugin data-init.client runs on client and calls useEvents() + useCategories(), provides as `$eventsData` / `$categoriesData`. useCalendarViewData() uses those when present, else calls useEvents/useCategories directly (e.g. SSR or EventModal).
2. **useEvents** – useFetch('/api/events', server: false), then flattenEventsByOccurrence (events.service) → one item per occurrence (FlatEvent).
3. **useCategories** – useFetch('/api/categories', server: false) → categories object.
4. **Monthly** – Page gets events from useCalendarViewData, getFilteredEventsForMonth from useEventFilters(events) → filteredEvents → MonthCarousel → MonthCalendar. MonthCalendar uses getEventsByDate + generateCalendarDays → calendarDays with day.events → DayCell.
5. **Daily** – Same events; getFilteredEventsByDate(visibleDays) from useEventFilters(events) → eventsByDate (date → transformed cards) → KanbanCarousel → KanbanColumn → KanbanEventCard.

**Files:** data-init.client, useEvents, useCategories, useCalendarViewData, server/api/events, server/api/categories, events.service, events.helpers, useEventFilters, monthly-view, daily-view, MonthCarousel, MonthCalendar, DayCell, KanbanCarousel, KanbanColumn, KanbanEventCard, calendar.helpers.

---

## Flow 3: Filtering (categories + hours → URL and calendar)

1. **UI** – CalendarViewHeader gets categories from page and filter state from calendarStore; CalendarViewNav opens FilterPopup/FilterModal with FilterPanel. FilterPanel: CategoryPill toggles → calendarStore.toggleCategory; HoursFilterPanel → setTimeRange / setTimePreset.
2. **Store** – calendar.store holds selectedCategories, timeFilterStart/End, timeFilterPreset. setFiltersFromUrl used by useUrlState.initializeFromUrl.
3. **URL / persistence** – useUrlState watchers update query (categories, timeStart, timeEnd, timePreset) and saveFilterPreference (localStorage). On load, initializeFromUrl applies query or saved preference.
4. **Application** – useEventFilters(events) reads store and exposes getFilteredEventsForMonth, getFilteredEventsByDate. Pages use these for filteredEvents / eventsByDate passed to carousels.

**Files:** CalendarViewNav, CalendarViewHeader, FilterPopup, FilterModal, FilterPanel, HoursFilterPanel, CategoryPill, calendar.store, useUrlState, useEventFilters, validation.helpers, events.service, calendar.const.

---

## Flow 4: Event modal (open from daily card or URL)

1. **Open** – KanbanEventCard click → uiStore.openEventModal(eventId). ui.store sets selectedEventId, isEventModalShowing, and router.push({ query: { ...query, event: eventId } }).
2. **Render** – app.vue renders EventModal when isEventModalShowing. EventModal uses useCalendarViewData() for events/categories, finds selectedEvent by selectedEventId, useEventModalData for display fields.
3. **Close** – closeEventModal clears state and removes `event` from query.
4. **URL restore** – initializeModalFromUrl() in both pages on mount; ui.store also watches route.query.event for back/forward.

**Files:** KanbanEventCard, ui.store, app.vue, EventModal, useCalendarViewData, useEventModalData, events.helpers, date.helpers, media.helpers, ui.const, EventModalHeader, EventModalInfoBar, EventModalActions.

---

## Flow 5: Categories (source and propagation)

1. **Source** – consts/events.const.js defines EVENT_CATEGORIES. server/consts/events.const.ts re-exports; server/api/categories returns them. useCategories fetches; plugin provides; useCalendarViewData exposes.
2. **Propagation** – Pages get categories from useCalendarViewData and pass as props: CalendarViewHeader → CalendarViewNav → FilterPopup/FilterModal → FilterPanel; MonthCarousel → MonthCalendar → DayCell; KanbanCarousel → KanbanColumn → KanbanEventCard. EventModal uses useCalendarViewData() (no prop). Filter state (selected IDs) lives in calendarStore; category definitions (labels, colors) come from props or useCalendarViewData.
3. **Usage** – getCategoryColor, getCategoryLabel (calendar-display.helpers) in DayCell, KanbanEventCard, EventModalHeader; FilterPanel renders CategoryPill list.

**Files:** events.const.js, server/api/categories, useCategories, useCalendarViewData, calendar-display.helpers, FilterPanel, DayCell, KanbanEventCard, EventModalHeader.

---

## Flow 6: Publisher portal (authentication + event management)

### 6.1 Authentication

1. User visits `/login`, enters phone number → `POST /api/auth/send-otp` generates a 6-digit OTP (HMAC-SHA256 hashed, 10-minute expiry) and sends it via WhatsApp (or logs to console in dev mode when WA credentials are absent).
2. User enters OTP → `POST /api/auth/verify-otp` verifies the hash, creates a 1-hour session token stored in MongoDB, sets `galiluz_auth` HttpOnly cookie.
3. `middleware/auth.ts` runs client-side only (`import.meta.server` guard). Protected routes: `/publisher/**` and `/admin/**`. It checks `authStore.isLoggedIn` or calls `checkAuth()` → `GET /api/auth/me` which validates the cookie via `requirePublisherAuth`.
4. `LayoutProtectedShell` wraps protected pages in `<ClientOnly>` so SSR renders a spinner and the real content mounts only after the auth check resolves (`authStore.authReady`).
5. **useAuthFetch** — wraps `useFetch` with `server: false` (skip SSR to avoid cookie mismatch) and an `onResponseError` hook: on 401, calls `authStore.logout()` and navigates to `/login`.

**Files:** `pages/login.vue`, `server/api/auth/`, `middleware/auth.ts`, `composables/useAuth.js`, `composables/useAuthFetch.js`, `stores/auth.store.js`, `server/utils/requirePublisherAuth.ts`, `components/layout/ProtectedShell.vue`.

### 6.2 Publisher dashboard

1. `pages/publisher/dashboard.vue` calls `useAuthFetch(‘/api/publisher/dashboard?filter=...’)`.
2. API aggregates: event counts (total/future/past), KPI totals (views, unique visitors, interactions), top 5 events by views, 6 most recent audit log entries.
3. Filter bar (כל האירועים / אירועים עתידיים / אירועים החודש) triggers re-fetch via `watch: [filter]`.
4. Dashboard KPI cards show brand-colored stats with skeleton loaders while pending.

### 6.3 Events list + event detail

1. `pages/publisher/events/index.vue` fetches all publisher events; filters client-side by future/past/all + text search (debounced 200ms).
2. `pages/publisher/events/[id].vue` fetches single event with stats (`GET /api/publisher/event/[id]`). Embeds `EventPreview` (the public event modal rendered inline, close button hidden, actions bar de-fixed on mobile). Statistics section shows per-occurrence stats for recurring events or aggregate for multi-day.
3. Edit button opens `EventFormModal` in `mode="edit"` pre-filled via `initFromData()`. On submit: `PATCH /api/publisher/event/[id]` → closes modal → refreshes data → shows success banner.
4. Delete button opens `EventDeleteModal` (user must type event name to confirm) → `DELETE /api/publisher/event/[id]` → navigate to events list.

### 6.4 Create / edit event form (EventFormModal)

`components/publisher/EventFormModal.vue` — full-screen modal (Teleport, mobile-native). Sections:

1. **Details** — title, short description (max 150 chars), full description (Tiptap rich text editor with emoji picker, min 70 chars, no links allowed, HTML sanitized server-side)
2. **Schedule** — OccurrenceRow instances (date + all-day toggle + start/end time pickers); multiDay toggle appears when ≥2 occurrences
3. **Category** — main category (CategorySelectDropdown, single select) + additional categories (max 3 extra = 4 total)
4. **Location** — place name, address, city (CityPicker with search dropdown), region (RegionSelectModal using the area map); auto-nav toggle
5. **Price** — number input (0 = free, blurs to null)
6. **Links** — up to 5 link/phone rows with per-field blur validation
7. **Media** — drag-and-drop with MIME/size/magic-byte validation client-side; video thumbnails generated via canvas; uploaded to Cloudinary via `POST /api/publisher/media` before form submit

On submit: media files uploaded in parallel (snapshotted to avoid mid-upload mutations) → event payload built → `POST /api/publisher/events` (create) or `PATCH` (edit) → emit `submitted` → parent navigates to `/publisher/events/:id?success=created`.

**Files:** `components/publisher/EventFormModal.vue`, `components/form/RichTextEditor.vue`, `components/form/CityPicker.vue`, `components/form/OccurrenceRow.vue`, `components/form/MediaUpload.vue`, `components/form/LinkRow.vue`, `components/form/CategorySelectDropdown.vue`, `components/form/RegionSelectModal.vue`, `server/api/publisher/events.post.ts`, `server/api/publisher/event/[id].patch.ts`, `server/api/publisher/media.post.ts`, `server/utils/sanitizeEventFields.ts`, `server/utils/convertOccurrenceTimes.ts`, `server/utils/eventValidation.ts`.

---

## Conventions

- **Composables:** Prefer composables for reusable, scoped logic; Pinia for global shared state (calendar filters, modal state, auth).
- **URL state:** useUrlState centralizes reading query → store and watching store → URL + localStorage. useCalendarPageInit wraps that plus modal-from-URL; both calendar pages call runPageInit() in onMounted. Route paths are in consts/calendar.const (ROUTE_MONTHLY_VIEW, ROUTE_DAILY_VIEW).
- **Data:** Events and categories are fetched once in the plugin and consumed via useCalendarViewData so components don’t re-fetch. EventModal also uses useCalendarViewData for the same source.
- **Authenticated fetching:** Use `useAuthFetch` (not `useFetch`) for all publisher API calls. It sets `server: false` and handles 401 redirects automatically.
- **Script order (components):** defineOptions → defineProps → defineEmits → data (composables, refs) → lifecycle → computed → methods → watchers. Import order: NPM → project (consts, utils) → components, with blank lines between groups.
- **CSS:** BEM naming under the component root class (`.ComponentName`, `.ComponentName-element`, `.ComponentName--modifier`). No `style scoped`. Breakpoints via `@include mobile` from `~/assets/css/breakpoints`.

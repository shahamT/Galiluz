# Galiluz – Architecture

High-level map of the system and the main flows: where each flow starts and which files it touches. Depth lives in the focused docs — see the doc map below.

## System overview

```
                       ┌───────────────┐
                       │ Browser / PWA │
                       └───────┬───────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────┐   REST + X-API-Key   ┌─────────────────────────┐
│ Nuxt web app — Render: galiluz-web      │◄─────────────────────│ apps/wa-bot             │
│ pages/ (SSR + SPA) · server/api (Nitro) │                      │ Render: galiluz-wa-bot  │
└──────┬──────────────┬───────────────┬───┘                      │ publisher/admin chat    │
       │              │               │ OTP send                 └───────────┬─────────────┘
       ▼              ▼               ▼                                      │ webhook + replies
┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐                  │
│ MongoDB     │ │ Cloudinary  │ │ Meta WhatsApp Cloud API │◄─────────────────┘
│ Atlas       │ │ (media)     │ └─────────────────────────┘
└──────▲──────┘ └──────▲──────┘
       │ direct        │ media
       │ inserts       │ uploads
┌──────┴───────────────┴───────────────────┐
│ apps/wa-listener — Render: galiluz-wa    │
│ Baileys group ingestion → OpenAI extract │
│ → event drafts written straight to Mongo │
└──────────────────────────────────────────┘
```

- **Web app** (repo root) — Nuxt 3: public calendar (`pages/events/`), publisher portal (`pages/publisher/`), admin (`pages/admin.vue`), and the Nitro API under [server/api/](../server/api/). Render service `galiluz-web` ([render.yaml](../render.yaml)).
- **MongoDB Atlas** — one cluster; dev/prod split by `MONGODB_DB_NAME`. Collections, indexes, validators, and the stored event shape: [DATA_MODEL.md](DATA_MODEL.md).
- **Cloudinary** — all event media. Uploaded by the web app (`POST /api/publisher/media`), wa-listener, and wa-bot; destroyed when an event is deleted (Flow 8).
- **apps/wa-listener** (Render worker `galiluz-wa`) — Baileys WhatsApp client that ingests configured groups, runs an OpenAI extraction pipeline, and inserts event drafts **directly into MongoDB** (no HTTP to the web app). Pipeline detail: [EVENT_OBJECT_INTEGRATION.md](EVENT_OBJECT_INTEGRATION.md); setup: [WHATSAPP_SERVICE.md](WHATSAPP_SERVICE.md).
- **apps/wa-bot** (Render web service `galiluz-wa-bot`) — Meta WhatsApp Cloud API webhook receiver for publisher/admin chat flows (publish, edit, delete, approval). It calls the web app's server API over REST with the shared `X-API-Key` header (`API_SECRET`) and depends on the shared [@galiluz/event-format](../packages/event-format/README.md) package. Setup: [WA_BOT_SETUP.md](WA_BOT_SETUP.md).
- **Meta WhatsApp Cloud API** — used by the web app server to send OTP login codes ([send-otp.post.ts](../server/api/auth/send-otp.post.ts)) and by wa-bot for all bot messaging. wa-listener does not use it (Baileys is a WhatsApp Web client).
- **Zoho SMTP** (`smtppro.zoho.com`) — owner notification emails from `noreply@galiluz.co.il` via [mailer.ts](../server/utils/mailer.ts): every feedback submission + throttled 5xx error alerts (one per error signature per 15 min, max 10/hour). Env-gated by `SMTP_*`/`MAIL_*` — unset = silently disabled. Ops detail: [PRODUCTION_OPS.md](PRODUCTION_OPS.md).
- **Cloudflare Turnstile** — bot gate on `POST /api/auth/send-otp` (the endpoint that triggers paid WhatsApp messages). Managed widget on `/login` ([useTurnstile.js](../composables/useTurnstile.js)), server-side siteverify **fail-closed** ([turnstile.ts](../server/utils/turnstile.ts)). **Production only — dev is exempt on both client and server.** Security detail: [SECURITY_AND_BUDGET.md](SECURITY_AND_BUDGET.md).

### Doc map

| Doc | Owns |
|-----|------|
| [DATA_MODEL.md](DATA_MODEL.md) | Collections, indexes, TTL policies, validators, stored event shape |
| [API.md](API.md) | Full endpoint inventory: methods, auth, params, responses |
| [FRONTEND.md](FRONTEND.md) | Component-level frontend detail, form internals, code conventions |
| [../composables/README.md](../composables/README.md) | Composables inventory |
| [PRODUCTION_OPS.md](PRODUCTION_OPS.md) | Env vars, deploy checklist, backups, rate limiting |
| [SECURITY_AND_BUDGET.md](SECURITY_AND_BUDGET.md) | OTP/auth detail, media validation, sanitization, API budget |
| [EVENT_OBJECT_INTEGRATION.md](EVENT_OBJECT_INTEGRATION.md) | wa-listener message → event pipeline |
| [../packages/event-format/README.md](../packages/event-format/README.md) | Shared formatted-event contract (wa-bot) |

## Directory layout (web app)

- **pages/** – public: `index` (redirect middleware), `events/monthly-view`, `events/daily-view`, `about`, `login`, `publish-events`, `terms-of-service`, `admin`, `[...slug]` (404). **Publisher portal:** `publisher/index` (redirect → dashboard), `publisher/dashboard`, `publisher/events/index`, `publisher/events/[id]`, edit/add-event pages.
- **components/** – `layout/` (AppShell, AppHeader, ProtectedShell), `controls/` (CalendarViewNav, CalendarViewHeader), `monthly/`, `daily/`, `ui/` (EventModal sub-parts, filters, pickers), `publisher/` (EventFormModal, EventPreview, dashboards, lists), `form/` (form sub-components). Root: EventModal, CalendarViewContent. Full inventory: [FRONTEND.md](FRONTEND.md).
- **composables/** – Data: useCalendarViewData, useEvents, useCategories. URL/state: useUrlState, useCalendarNavigation, useCalendarPageInit. Filtering: useEventFilters. Modal: useEventModalData, useEventModalGallery, useEventModalShare. Auth: **useAuthFetch**. Full list: [../composables/README.md](../composables/README.md).
- **stores/** – calendar.store (filters, currentDate, lastDailyViewDate), ui.store (event modal + URL sync), **auth.store** (user, authReady, isLoggedIn, isManager).
- **utils/** – events.service, events.helpers, calendar.helpers, calendar-display.helpers, date.helpers, validation.helpers, navigation.service, calendar.service, media.helpers, israelDate, logger.
- **consts/** – events.const (EVENT_CATEGORIES, CATEGORY_GROUPS), calendar.const, ui.const, regions.const (CITIES, REGIONS).
- **plugins/** – data-init.client (fetches events + categories once, provides to app), sw.client, posthog.client, polyfills.client.
- **server/** – API routes under [server/api/](../server/api/) (see [API.md](API.md)), shared logic in [server/utils/](../server/utils/), startup plugins in [server/plugins/](../server/plugins/) (ensure-indexes, startup-checks, error-logging).

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
2. **useEvents** – useFetch('/api/events', `server: true`, query `{ to: <window end> }`). On the server the request carries the `X-API-Key` header from runtime config; the client reuses the SSR payload via `getCachedData`, so the secret never reaches the browser. Results flattened with flattenEventsByOccurrence (events.service) → one item per occurrence (FlatEvent). The `to` bound is the rolling feed window — see Flow 7.
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

Auth internals (hashing, timing-safe checks, rate limits): [SECURITY_AND_BUDGET.md](SECURITY_AND_BUDGET.md).

**Files:** `pages/login.vue`, `server/api/auth/`, `middleware/auth.ts`, `composables/useAuth.js`, `composables/useAuthFetch.js`, `stores/auth.store.js`, `server/utils/requirePublisherAuth.ts`, `components/layout/ProtectedShell.vue`.

### 6.2 Publisher dashboard

1. `pages/publisher/dashboard.vue` calls `useAuthFetch('/api/publisher/dashboard?filter=...')`.
2. API aggregates: event counts (total/future/past), KPI totals (views, unique visitors, interactions), top 5 events by views, 6 most recent audit log entries. Stats queries exclude soft-deleted events' data (Flow 8).
3. Filter bar (כל האירועים / אירועים עתידיים / אירועים החודש) triggers re-fetch via `watch: [filter]`.
4. Dashboard KPI cards show brand-colored stats with skeleton loaders while pending.

### 6.3 Events list + event detail

1. `pages/publisher/events/index.vue` fetches all publisher events; filters client-side by future/past/all + text search (debounced 200ms).
2. `pages/publisher/events/[id].vue` fetches single event with stats (`GET /api/publisher/event/[id]`). Embeds `EventPreview` (the public event modal rendered inline). Statistics section shows per-occurrence stats for recurring events or aggregate for multi-day.
3. Edit button opens `EventFormModal` in `mode="edit"` pre-filled via `initFromData()`. On submit: `PATCH /api/publisher/event/[id]` → closes modal → refreshes data → shows success banner.
4. Delete button opens `EventDeleteModal` (user must type event name to confirm) → `DELETE /api/publisher/event/[id]` → soft delete (Flow 8) → navigate to events list.

### 6.4 Create / edit event form (EventFormModal)

`components/publisher/EventFormModal.vue` — full-screen modal (Teleport, mobile-native) with sections for details (title, descriptions, rich text), schedule (OccurrenceRow instances, multiDay toggle), category (main + up to 3 extra), location (place, city, region), price, links (up to 5), and media (client-side validation, Cloudinary upload via `POST /api/publisher/media` before submit).

On submit: media files uploaded in parallel → event payload built → `POST /api/publisher/events` (create) or `PATCH /api/publisher/event/[id]` (edit) → emit `submitted` → parent navigates to `/publisher/events/:id?success=created`.

Form internals (per-field validation, sub-components): [FRONTEND.md](FRONTEND.md). Server-side validation/sanitization and endpoint contracts: [API.md](API.md).

---

## Flow 7: Events feed windowing (rolling window)

The public feed is never "everything" — the client requests a bounded window and grows it on navigation.

1. **Server bounds** – `GET /api/events` ([index.get.ts](../server/api/events/index.get.ts)) accepts optional `from` / `to` (YYYY-MM-DD). The lower cutoff defaults to the first day of the current month minus 5 days (`from` overrides it); `to` caps the feed — events whose occurrences all start after end-of-day `to` are excluded ([buildEventsQuery](../server/utils/eventsQuery.ts)). Hard limit 500 documents, `rawEvent` excluded from the projection, `Cache-Control: public, max-age=60`.
2. **Client window** – [useEvents](../composables/useEvents.js) keeps `windowEnd` in `useState('events-window-end')`: initially the current month + 2 (`WINDOW_MONTHS_AHEAD`), or the deep-linked month + 2 if further (read from `?date=` / `?year=&month=`). The fetch query is `{ to: lastDayOfMonth(windowEnd) }`.
3. **Expansion on far navigation** – both calendar pages watch their displayed month (monthly: `currentDate`; daily: `headerDate`) and call `ensureMonthLoaded(year, month)` (exposed through useCalendarViewData). It bumps `windowEnd` to `month + 2` when needed; since the query is reactive, useFetch refetches `/api/events` with the new `to`.
4. **Monotonic** – the window only ever grows, so events already on screen never disappear when navigating back.

**Files:** server/api/events/index.get.ts, server/utils/eventsQuery.ts, composables/useEvents.js, composables/useCalendarViewData.js, pages/events/monthly-view.vue, pages/events/daily-view.vue.

---

## Flow 8: Soft delete (deletedAt everywhere)

Events are never hard-deleted by user action; they are stamped with `deletedAt` and every read filters them out.

1. **Entry points** – publisher portal `DELETE /api/publisher/event/[id]` ([\[id\].delete.ts](../server/api/publisher/event/%5Bid%5D.delete.ts), session auth + ownership/manager check) and wa-bot `POST /api/events/[id]/delete` ([delete.post.ts](../server/api/events/%5Bid%5D/delete.post.ts), `X-API-Key`, `deletionType: 'kill' | 'user_deleted'`). Both are idempotent: an already-deleted event returns success.
2. **Write order** – deletion is logged to `eventLogs` first (logEventDeletion, with `isManagerAction` when a manager deletes someone else's event), then the event doc is stamped `{ deletedAt, isActive: false }`, then [softDeleteEventStatsData](../server/utils/eventStats.service.ts) stamps the same `deletedAt` on all the event's `eventStats`, `eventOccurrenceStats`, and `eventInteractions` docs (retried once; [scripts/cleanup-orphan-stats.js](../scripts/cleanup-orphan-stats.js) is the consistency sweep for anything missed). Finally Cloudinary media is destroyed (deleteEventCloudinaryMedia).
3. **eventLogs are NOT stamped** – intentionally, so the dashboard's recent-activity feed keeps showing deletions.
4. **Reads** – every read path excludes deleted data: the public feed and publisher events list use the `NOT_DELETED` fragment (`{ deletedAt: { $exists: false } }` in [eventsQuery.ts](../server/utils/eventsQuery.ts)); dashboard stats aggregations filter `deletedAt: { $exists: false }`; single-event GET returns 404 when `deletedAt` is set; the interaction tracker refuses to record against deleted events.
5. **Rule for agents** – any new query over events or stats collections must include `NOT_DELETED` (import it from `server/utils/eventsQuery.ts`) unless it deliberately targets deleted docs.

**Files:** server/api/publisher/event/[id].delete.ts, server/api/events/[id]/delete.post.ts, server/utils/eventStats.service.ts, server/utils/eventsQuery.ts, server/api/publisher/dashboard.get.ts, server/api/events/[id]/interact.post.ts, scripts/cleanup-orphan-stats.js.

---

## Conventions (flow-level)

- **Composables vs stores:** composables for reusable, scoped logic; Pinia for global shared state (calendar filters, modal state, auth).
- **URL state:** useUrlState centralizes reading query → store and watching store → URL + localStorage. useCalendarPageInit wraps that plus modal-from-URL; both calendar pages call runPageInit() in onMounted. Route paths live in consts/calendar.const.
- **Data:** events and categories are fetched once (plugin) and consumed via useCalendarViewData so components don't re-fetch. EventModal uses the same source.
- **Authenticated fetching:** use `useAuthFetch` (not `useFetch`) for all publisher API calls — it sets `server: false` and handles 401 redirects automatically. Direct `$fetch()` calls do NOT get automatic 401 handling.

Component code conventions (script section order, import order, SCSS BEM): [FRONTEND.md](FRONTEND.md).

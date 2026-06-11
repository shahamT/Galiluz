# Galiluz – Frontend

Component-level detail for the Nuxt 3 web app: pages, data flow, state, the carousel architecture, modals, PWA install, styling, tracking, and code conventions. System-level flows live in [ARCHITECTURE.md](ARCHITECTURE.md); API contracts in [API.md](API.md); composable inventory in [../composables/README.md](../composables/README.md).

The app is Hebrew RTL throughout (`htmlAttrs: { lang: 'he', dir: 'rtl' }` in [nuxt.config.ts](../nuxt.config.ts)). See [RTL rules](#rtl-rules) before touching layout.

## Pages map

File-based routing under [pages/](../pages/). Middleware is applied per page via `definePageMeta` — there is no global route middleware.

| Route | File | Middleware | Purpose |
|-------|------|------------|---------|
| `/` | [index.vue](../pages/index.vue) | `index-redirect` | Empty template; redirect only |
| `/events` | [events/index.vue](../pages/events/index.vue) | `index-redirect` | Redirect only. Parent [events.vue](../pages/events.vue) wraps children in `LayoutAppShell` + `<NuxtPage />` |
| `/events/daily-view` | [events/daily-view.vue](../pages/events/daily-view.vue) | — | Daily kanban: `DailyKanbanCarousel`, header nav, filters. Reads `?date=` (or resolves `?event=` to its first occurrence) |
| `/events/monthly-view` | [events/monthly-view.vue](../pages/events/monthly-view.vue) | — | Monthly grid: `MonthlyMonthCarousel`. Reads `?year=&month=` |
| `/login` | [login.vue](../pages/login.vue) | `auth` | WhatsApp OTP login (phone → OTP → success). `auth` redirects already-logged-in users away |
| `/admin` | [admin.vue](../pages/admin.vue) | `auth` | Manager-only placeholder (TODO body) |
| `/publisher` | [publisher/index.vue](../pages/publisher/index.vue) | `auth` | Redirect → `/publisher/dashboard` |
| `/publisher/dashboard` | [publisher/dashboard.vue](../pages/publisher/dashboard.vue) | `auth` | KPI cards, top events, recent logs from `/api/publisher/dashboard`; add-event modal |
| `/publisher/events` | [publisher/events/index.vue](../pages/publisher/events/index.vue) | `auth` | Event list with search + future/past filter, empty-state variants, add-event modal. Parent [publisher/events.vue](../pages/publisher/events.vue) is a bare `<NuxtPage />` wrapper |
| `/publisher/events/:id` | [publisher/events/[id].vue](../pages/publisher/events/[id].vue) | `auth` | Event detail + stats; edit/status/delete modals; `?success=created\|updated` banner |
| `/publisher/events/edit/:id` | [publisher/events/edit/[id].vue](../pages/publisher/events/edit/[id].vue) | — | Redirect → `/publisher/events/:id` |
| `/publisher/event/:id` | [publisher/event/[id].vue](../pages/publisher/event/[id].vue) | — | Legacy redirect → `/publisher/events/:id` |
| `/publisher/add-event` | [publisher/add-event.vue](../pages/publisher/add-event.vue) | — | Legacy redirect → `/publisher/events` |
| `/publisher/edit-event/:id` | [publisher/edit-event/[id].vue](../pages/publisher/edit-event/[id].vue) | — | Legacy redirect → `/publisher/events/edit/:id` |
| `/about`, `/publish-events`, `/terms-of-service` | [about.vue](../pages/about.vue) etc. | — | Static pages in `LayoutAppShell` + `LayoutContentCard` |
| `/*` | [[...slug].vue](../pages/[...slug].vue) | — | 404 page with back-to-monthly button |

### Middleware behavior

- **[index-redirect.ts](../middleware/index-redirect.ts)** — acts only on `/` and `/events`. Redirects (replace) to `/events/daily-view` with `{ event }` if the URL has `?event=` (shareable links, e.g. from wa-bot), otherwise `{ date: <today ISO> }`.
- **[auth.ts](../middleware/auth.ts)** — returns early on server (`import.meta.server`); auth is client-only because the session is an HttpOnly cookie. For protected routes (`/admin`, `/publisher/*`) it resets `authStore.authReady`, then checks `authStore.isLoggedIn || checkAuth()` (`$fetch('/api/auth/me')`, which sets or clears the store). Unauthenticated → `/login`. `/admin` additionally requires `authStore.isManager`, else → `/publisher/dashboard`. A logged-in user hitting `/login` is sent to `/admin` (manager) or `/publisher/dashboard`. On success it calls `authStore.setAuthReady()` — [ProtectedShell.vue](../components/layout/ProtectedShell.vue) renders an `AuthLoader` (inside `ClientOnly`) until `authReady` is true, so protected pages never flash unauthenticated content.

## Data flow

### Plugin DI: one fetch for the whole app

[plugins/data-init.client.js](../plugins/data-init.client.js) calls `useEvents()` and `useCategories()` once at client app start and provides them as `nuxtApp.$eventsData` / `$categoriesData`. Components never call `useEvents()` directly — they use [useCalendarViewData()](../composables/useCalendarViewData.js), which returns the plugin-provided instances when present and falls back to direct calls (SSR, where client plugins don't run). It merges loading/error state and passes through `ensureMonthLoaded`.

### useEvents: rolling feed window

[composables/useEvents.js](../composables/useEvents.js):

- `windowEnd` is a `useState('events-window-end')` `{ year, month }` — it survives navigation. Initialized to **current month + 2** (`WINDOW_MONTHS_AHEAD`), or the deep-linked month + 2 if the route targets a later month (daily `?date=` or monthly `?year=&month=`).
- The fetch is `useFetch('/api/events', { key: 'events', server: true, query: { to: lastDayOfMonth(windowEnd) } })`. The query is a `computed`, so growing `windowEnd` automatically refetches with a larger `to=`.
- `ensureMonthLoaded(year, month)` is **expansion-only**: it grows `windowEnd` to `month + 2` when needed and never shrinks, so already-loaded events never disappear mid-session. Both calendar pages call it from a watcher on the viewed month.
- **SSR + secret**: the `X-API-Key` header (`config.apiSecret`) is attached only when `import.meta.server`. On the client, `getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]` reuses the SSR payload, so the secret never reaches the browser and hydration makes no duplicate request.
- The returned `data` is computed through `flattenEventsByOccurrence()` ([utils/events.service.js](../utils/events.service.js)): the API returns events with an `occurrences` array; the app works with one flat item **per occurrence** (`date`, `startTime`, `endTime` hoisted to top level). All calendar display code assumes this flat shape.

[useCategories()](../composables/useCategories.js) is **client-only** (`server: false`, no API key, no `getCachedData`) — do not assume categories exist during SSR.

### Filtering

[useEventFilters(events)](../composables/useEventFilters.js) applies the calendar store's category/region/time filters: `getFilteredEventsForMonth(year, month)` (monthly grid), `getFilteredEventsForDate(date)`, and `getFilteredEventsByDate(dates)` → `{ date: [card objects] }` used by the daily carousel (cards transformed via `transformEventForCard`).

### useAuthFetch and the 401 rule

[composables/useAuthFetch.js](../composables/useAuthFetch.js) wraps `useFetch` with `server: false` (SSR has no cookie — without it, pages would hydrate with empty 401 results) and an `onResponseError` that, on 401, logs out and redirects to `/login`. A **module-level single-flight flag** (`handling401`) guarantees parallel 401s trigger exactly one logout/redirect. A caller-supplied `onResponseError` runs first.

Rules:
- Use `useAuthFetch` for **all** `/api/publisher/**` calls.
- Raw `$fetch()` has **no** automatic 401 handling — catch errors manually (used for mutations and auth endpoints).

## State

### Pinia stores

All in [stores/](../stores/), setup-style, auto-imported.

| Store | Fields | Actions |
|-------|--------|---------|
| [calendar.store.js](../stores/calendar.store.js) `useCalendarStore` | `selectedCategories[]`, `selectedRegions[]`, `currentDate {year,month}` (displayed month), `timeFilterStart/End` (minutes 0–1440), `timeFilterPreset`, `lastDailyViewDate` (restored when switching monthly → daily) | `toggleCategory/Region`, `setSelectedRegions`, `resetFilter`, `setTimeRange` (clamps), `setTimePreset` (from `TIME_FILTER_PRESETS`), `clearTimePreset`, `setCurrentDate`, `setLastDailyViewDate`, `setFiltersFromUrl` (bulk) |
| [ui.store.js](../stores/ui.store.js) `useUiStore` | `isEventModalShowing`, `selectedEventId`, `selectedOccurrenceDate` (for tracking), `isWelcomeModalShowing`, `welcomeModalShownThisSession`, `requestFilterPopupOpen` | `openEventModal(id, occurrenceDate)` / `closeEventModal()` (both `router.push` the `?event=` param), `initializeModalFromUrl()`, `setWelcomeModalShowing`, `requestOpenFilterPopup`. A watcher on `route.query.event` syncs browser back/forward with modal state |
| [auth.store.js](../stores/auth.store.js) `useAuthStore` | `user` (null when logged out), `authReady` | `setUser`, `login`, `logout` (clears user + authReady), `setAuthReady`/`resetAuthReady`. Computed: `isLoggedIn`, `isManager` (`type === 'manager'`), `canManageAll`, `canManageOwn` |
| [filterNotify.store.js](../stores/filterNotify.store.js) `useFilterNotifyStore` | `visible`, `activeFilterCount`, `filterSummary`, `hasShownThisSession` | `requestShow(...)` — shows the active-filters bar once per session, only on calendar routes, never over an open modal or after the welcome flow; 1s delay, 8s auto-dismiss. `handleReset`/`handleChangeFilters`/`handleClose` |

### URL + localStorage filter sync

[useUrlState({ syncMonth })](../composables/useUrlState.js) syncs the calendar store with the URL. Monthly uses `?year=&month=` (`syncMonth: true`); daily preserves `?date=`. Filters serialize to `?categories=`, `?regions=`, `?timeStart=`, `?timeEnd=`, `?timePreset=`.

- `initializeFromUrl()` (once, on mount): **URL wins** when it contains any filter param (then also saved as the preference); otherwise the saved preference from `localStorage['galiluz-calendar-filters']` (`FILTER_PREFERENCE_STORAGE_KEY`) is applied. This is how filters persist across sessions.
- `startUrlSync()`: watches the store and writes back via `router.replace` (no history pollution), preserving `?event=`. Filter changes also re-save the localStorage preference.
- Both calendar pages run this through [useCalendarPageInit](../composables/useCalendarPageInit.js)'s `runPageInit()` in `onMounted` (init → sync → `uiStore.initializeModalFromUrl()`).

### Event form drafts

[useEventDraft()](../composables/useEventDraft.js) persists publisher form state to localStorage: key `galiluz-event-draft-add` or `galiluz-event-draft-edit-{id}`. Saves `{ mode, eventId, savedAt, form, existingMedia }` with `form.media` stripped to `[]` (File objects can't be serialized). Drafts live in localStorage and are untouched by `logout()` — they survive auth expiry, which matters because OTP sessions can lapse mid-edit. `?draft=<key>` on the events list reopens the form with the draft.

## Carousel architecture

Two Swiper-based carousels share one architecture: [components/daily/KanbanCarousel.vue](../components/daily/KanbanCarousel.vue) (`DailyKanbanCarousel`) and [components/monthly/MonthCarousel.vue](../components/monthly/MonthCarousel.vue) (`MonthlyMonthCarousel`). Read this whole section before modifying either — the interruptible-swipe behavior depends on every piece.

### Ownership: page owns the window, carousel owns the gesture

The slide window (`visibleDays` / `visibleMonths`) is computed in the **page** from a local `windowCenter` ref that is deliberately **decoupled from the route/store**:

- Daily ([daily-view.vue](../pages/events/daily-view.vue)): `windowCenter` (a `YYYY-MM-DD` string) ± `DAILY_CAROUSEL_DAYS_RANGE` (4, [consts/calendar.const.js](../consts/calendar.const.js)) → 9 day slides. The active date lives in the route (`?date=`, read as `dateParam`).
- Monthly ([monthly-view.vue](../pages/events/monthly-view.vue)): `windowCenter` (`{year, month}`) ± `MONTH_CAROUSEL_RANGE` (2, local const) → 5 month slides, one per view. The active month lives in `calendarStore.currentDate`.

Why decoupled: the route/store updates on every swipe **mid-animation**, but the window only re-centers after the slide **settles**. If the window were derived from the route, slides would shift under an in-flight animation.

### Emit contract

| Emit | Fired on | Parent reaction |
|------|----------|-----------------|
| `date-change` / `month-change` | Swiper `slideChange` — immediately on swipe commit, while the animation is still running. Suppressed when `isProgrammaticSlideRef` was set | Daily: `router.replace({ query: { ...query, date } })` (swipes must not pollute history) and clear `slideToDateRequest`. Monthly: `calendarStore.setCurrentDate(payload)` and clear `slideToMonthRequest`. Header/URL update instantly |
| `settled` | Swiper `slideChangeTransitionEnd` | Re-center the window **only near the edges**: if the active index is `< 2` or `> length - 3`, set `windowCenter` to the active date/month. Otherwise nothing — the window stays put |

### Silent re-center on window swap

When `windowCenter` moves, the page recomputes `visibleDays`/`visibleMonths` and the carousel must not visibly jump:

1. The `v-for` is keyed by date (`:key="date"`) / month (`` :key=`${year}-${month}` ``), so Vue reuses slide DOM for entries present in both old and new windows.
2. A watcher on `visibleDays`/`visibleMonths` captures the previously active date from `oldDays[swiper.activeIndex]`, awaits `nextTick()` (DOM updated), then sets `isProgrammaticSlideRef = true` and calls `swiper.slideTo(newIndex, 0)` — instant, before paint. If the old active entry left the window (far jump), it targets `props.currentDate` instead.

### `isProgrammaticSlideRef`

Set immediately before a programmatic `slideTo` whose resulting `slideChange` must not be treated as a user gesture. `handleSlideChange` reads it, **resets it to false**, and when it was set: skips the past-date snap-back and skips the `date-change`/`month-change` emit (which would otherwise loop parent ↔ carousel). Setters: the window-swap watcher (both carousels) and MonthCarousel's `currentDate` watcher. KanbanCarousel's `currentDate` watcher slides **animated without the flag** — the resulting emit is harmless because the parent ignores a `date-change` equal to the current `dateParam`.

### External navigation in

- `currentDate` prop watcher: when the route/store date changes to another in-window slide (deep link, back/forward), the carousel slides to it (Kanban: animated; Month: instant + flag).
- Out-of-window ("far jump", e.g. month-year picker): a page watcher detects `currentDate ∉ window` and rebuilds `windowCenter` around it; the window-swap watcher then restores position instantly.
- **Header arrows** (`slideToDateRequest` / `slideToMonthRequest` props): the page's prev/next handlers check whether the target is in the window — if yes, set the request prop (the carousel watcher does an animated `slideTo`; the resulting `date-change` clears the request), if no, navigate/setCurrentDate (window rebuild path). Do not call Swiper APIs from pages directly; this prop pair is the only external slide API.

### Past blocking

- `firstValidIndex` = first slide ≥ today (daily) / not before the current month (monthly). Slides before it render disabled (`isDatePast` → `KanbanColumn` `is-disabled`).
- `canSlideToPast` computed (`activeIndex > firstValidIndex`) binds `:allow-slide-prev`. Because Swiper caches params, the flag is **also re-applied imperatively** (`swiper.allowSlidePrev` and `swiper.params.allowSlidePrev`) in `onSwiperReady`, `touchStart`, `slideChange`, and `transitionEnd` handlers. Note: in RTL, "prev" = sliding toward the past.
- Snap-back: if a non-programmatic slide still lands on a past slide (e.g. momentum), `handleSlideChange` calls `swiper.slideTo(firstValidIndex)` and returns without emitting.
- The daily header's prev arrow is disabled via `isTodayOrPast`, computed only after mount to avoid SSR hydration mismatch (the server doesn't know the client's "today"; monthly does the same with `isCurrentMonth`).

### Mid-flight grab (interruptible swipe)

The `touchStart` handler in `swiperEventHandlers` makes an in-progress animation grabbable: if `swiper.animating`, it freezes the wrapper at its current translate (`setTranslate(getTranslate())`, `setTransition(0)`, `animating = false`) and refreshes `updateActiveIndex()` / `updateSlidesClasses()`, so the new drag continues from exactly where the animation was.

### Sizing and per-slide data

- `--slide-count` is set as an inline style from the window length and used in the SCSS width calc for `.swiper-wrapper` / `.swiper-slide` (desktop shows 3 day columns; monthly shows 1 month). Swiper's own pagination/nav UI is hidden.
- Monthly: `eventsByMonth` is a page-computed map keyed `` `${year}-${month}` `` (unpadded) with each visible month's **filtered** events, so neighbor months render correctly during the swipe — never pass only the active month's events.
- Daily: `eventsByDate` comes from `getFilteredEventsByDate(visibleDays)`.
- Daily deep link by event: on mount with `?event=` and no valid `?date=`, the page fetches `/api/events/:param/first-occurrence` and replaces the route with `{ date, event }` (falls back to today on error).
- Swiper config notes: `:dir="'rtl'"`, `centered-slides`, `resistance-ratio: 0` (hard stop at edges), slides use `touch-action: pan-y` so vertical scrolling stays native.

## Modals

- **Event detail modal** ([components/EventModal.vue](../components/EventModal.vue)) renders once at app root in [app.vue](../app.vue): `v-if="isEventModalShowing && !isProtectedRoute"`. Open/close goes through `uiStore.openEventModal/closeEventModal`, which also push/remove the `?event=` query param — the URL is the shareable source of truth, and the store watcher handles browser back/forward. On page load, `initializeModalFromUrl()` (via `runPageInit`) restores an open modal from the URL. Data comes from [useEventModalData](../composables/useEventModalData.js) (with gallery/image-popup/share sub-composables); opening tracks a `view` interaction.
- **Welcome onboarding** (`UiWelcomeModal`) and the **filter notify bar** (`UiFilterNotifyBar`) also render at app root, driven by `uiStore`/`filterNotifyStore`.
- **Filter UI**: `UiFilterPopup` (desktop, floating-vue) and `UiFilterModal` (full-screen, Teleport) host `UiFilterPanel` (categories / regions / hours tabs) writing straight to the calendar store. `uiStore.requestOpenFilterPopup()` lets remote UI (notify bar) open it.
- **Publisher modals** are page-local `ref` flags, not store state: `PublisherEventFormModal` (add/edit; saves drafts via `useEventDraft`), `PublisherEventStatusModal`, `PublisherEventDeleteModal` (soft delete). URL hooks: `?modal=add` (events list) / `?modal=edit` (detail page) auto-open on mount, `?draft=` resumes a draft, `?success=created|updated` shows a 4s banner then is stripped with `router.replace`.

### Empty states

[PublisherDashboardEmptyState](../components/publisher/DashboardEmptyState.vue) is the shared empty state (illustration + text + optional action button; `compact` variant used inside `DashboardTopEvents` and `DashboardRecentLogs`). The events list renders four variants in priority order: no events at all → search with no matches (reset button) → no future events → no past events.

## PWA / install

- PWA basics: `manifest.webmanifest` + apple meta tags in [nuxt.config.ts](../nuxt.config.ts); [plugins/sw.client.js](../plugins/sw.client.js) registers `/sw.js`.
- [useInstallPrompt()](../composables/useInstallPrompt.js) holds **module-scope** shared state (`canInstall`, `isIOS`, `isInstalled`, `showInstructions`, `triggerInstall`) with a one-time listener guard. It captures `beforeinstallprompt` (preventDefault, stash the event), listens for `appinstalled`, detects standalone mode (`display-mode: standalone` / `navigator.standalone`) and iOS via UA.
- [UiInstallBanner](../components/ui/UiInstallBanner.vue) is the first child of [AppShell](../components/layout/AppShell.vue), above `LayoutAppHeader` — both sit above the scroller in the 100dvh flex column, so the banner is pinned, full-width, and never overlaps content (the shell grows to include it). Dark-green strip, white centered text ("הוסיפו את גלילו"ז למסך הבית שלכם"), close button absolutely positioned at `inset-inline-end`.
- Visibility: `!isInstalled && !dismissed && (canInstall || isIOS)`. Dismiss is an **in-memory ref only** — no storage; the banner reappears on every fresh page load by design. Don't "fix" this by persisting it.
- Tap: navigates to `/events`, then Android/Chrome → `triggerInstall()` (native prompt); iOS → `showInstructions = true`, which renders [UiInstallInstructions](../components/ui/UiInstallInstructions.vue) in AppShell (manual share → add-to-home-screen steps).
- [UiMainMenu](../components/ui/MainMenu.vue) has an install item with the same visibility condition and the same Android/iOS branching.

## Styling

### Files

[assets/css/](../assets/css/): `main.scss` (entry — imports the rest plus Swiper and floating-vue CSS), `variables.scss` (all CSS custom properties: colors, brand greens/blues, spacing scale, typography, radii, shadows, scrollbar, `--content-max-width`), `setup.scss` (reset, `html/body { direction: rtl; overflow: hidden }`, global green scrollbar styling), `typography.scss`, `_breakpoints.scss`.

Never hardcode colors/spacing — use the variables. Breakpoints come from the mixins, imported per component:

```scss
@use '~/assets/css/breakpoints' as *;
// @include mobile { ... }        max-width 768px
// @include mobile-narrow { ... } max-width 560px
// @include desktop { ... }       min-width 769px
```

### BEM

`.ComponentName-element--modifier`, flat (no deep nesting), always `<style lang="scss">` without `scoped` — BEM blocks are the isolation mechanism.

### RTL rules

- Global direction is RTL (`nuxt.config.ts` + `setup.scss`). In an RTL flex row the **first DOM child is rightmost** — reposition with CSS `order`, don't reorder the DOM.
- **Scrollbar-at-edge trick**: `.AppShell-scroller` is `direction: ltr` so the scrollbar lands at the screen edge instead of between content and edge; `.AppShell-content` inside flips back to `direction: rtl`. Keep both halves if you touch the shell.
- Material Symbols need `direction: ltr` ([UiIcon](../components/ui/Icon.vue) sets it). Icons also wait on [useIconFontReady](../composables/useIconFontReady.js) so glyph names don't flash as text.
- Carousels pass `:dir="'rtl'"` to Swiper and set `direction: rtl` on their containers.
- Prefer logical properties (`inset-inline-end`, `padding-inline`) over left/right.

### Shell layout

[AppShell](../components/layout/AppShell.vue) is `height: 100dvh` (with `100vh` fallback) flex column: install banner → header → scroller. `html/body` are `overflow: hidden` — `.AppShell-scroller` is the **only** scroll container. Content is centered at `--content-max-width` (940px) with mobile padding overrides.

## Tracking

### First-party interaction tracking

[useEventTracking()](../composables/useEventTracking.js) → `track(eventId, action, extra)` POSTs to `/api/events/:id/interact` with a `visitorId` (UUID in `localStorage['galiluz_visitor_id']`, generated once per device) and, for `view`/`calendar` actions, the `occurrenceDate` from `uiStore.selectedOccurrenceDate`.

- **View dedupe**: `view` actions are keyed `eventId:occurrenceDate` in `sessionStorage['galiluz_seen_views']` (capped at 200) — reopening the same event in a session doesn't inflate stats.
- **Retry queue**: failed sends are queued in `sessionStorage['galiluz_pending_interactions']` (cap 20) and flushed after the next successful send; each item gets **max 2 attempts total**, then is dropped. Built for flaky mobile networks — don't add timers/loops to it.

### PostHog

[plugins/posthog.client.js](../plugins/posthog.client.js) provides `$posthog`; [usePosthog()](../composables/usePosthog.js) exposes `capture`/`identify` that **no-op when PostHog isn't initialized** (SSR-safe, dev-safe). Visitor-facing event names live in [consts/analytics.const.js](../consts/analytics.const.js) (`event_viewed`, `event_shared`, `event_added_to_calendar`, `event_navigation_used`, `event_contact_publisher_clicked`, `event_custom_link_clicked`). Publisher portal events are captured inline as string literals: `publisher_event_created` (with `source: 'dashboard' | 'events_list'`), `publisher_event_edited`, `publisher_event_status_changed`, `publisher_event_deleted` (in [dashboard.vue](../pages/publisher/dashboard.vue), [events/index.vue](../pages/publisher/events/index.vue), [events/[id].vue](../pages/publisher/events/[id].vue)).

## Conventions

- **`<script setup>` only**, with `defineOptions({ name })` on every component. Section order: defineOptions → props → emits → composables/stores/refs → lifecycle → computed → methods → watchers.
- **Auto-imports**: `composables/`, `stores/`, and `utils/` are auto-imported (`imports.dirs` in [nuxt.config.ts](../nuxt.config.ts)); components are auto-registered. Don't add manual imports for these.
- **Component naming = folder prefix + filename**: `components/publisher/DashboardKpiCard.vue` → `<PublisherDashboardKpiCard>`, `components/daily/KanbanCarousel.vue` → `<DailyKanbanCarousel>`, `components/layout/AppShell.vue` → `<LayoutAppShell>`, `components/controls/CalendarViewHeader.vue` → `<ControlsCalendarViewHeader>`. Nuxt dedupes a prefix already in the filename: `ui/UiInstallBanner.vue` → `<UiInstallBanner>`, `form/FormField.vue` → `<FormField>` (but `form/MediaUpload.vue` → `<FormMediaUpload>`). Root-level components have no prefix (`<EventModal>`, `<CalendarViewContent>`).
- **`v-if` vs `disabled`**: `v-if` removes the element (modals, conditional sections); `disabled` keeps it in the DOM when it should remain visible but inert (e.g. the calendar nav prev arrow).
- **Navigation**: use `navigateTo()`; for swipe-driven and state-sync URL updates use `router.replace` (no history entries). Update the store before navigating when both change.
- **Data fetching**: `useFetch`/`useAuthFetch` for component data; `$fetch` for mutations and one-off side effects (and catch its errors yourself — no 401 handling).
- **Teleport to body** for modals/lightboxes that must escape stacking contexts; everything else renders in place.

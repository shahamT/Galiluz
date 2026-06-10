# Composables

Composables are auto-imported. Use them in setup, plugins, or route middleware.

## Conventions

**Import order** (in any file): NPM packages → Hooks/Services → Components → SVG/Icons, with blank lines between groups.

**Vue script section order** (in components): `defineOptions` (name) → `defineProps` → `defineEmits` → data (composables, stores, refs) → lifecycle hooks → computed → methods → watchers → component imports.

**Page init:** useCalendarPageInit({ syncMonth }) returns runPageInit(). Call runPageInit() from onMounted in monthly-view and daily-view so URL init, URL sync watchers, and modal-from-URL run in one place.

## Key composables

### useAuthFetch

Wraps `useFetch` for publisher-authenticated API calls. Two important behaviors:

- **`server: false`** — skips SSR to avoid making authenticated requests without a cookie. Without this, SSR fetches would return 401 and the empty result would be hydrated before the client cookie is available, causing the page to flash empty data on first load.
- **`onResponseError`** — on any 401 response, calls `authStore.logout()` and navigates to `/login`.

Use `useAuthFetch` instead of `useFetch` for **all** calls to `/api/publisher/**`.

```js
const { data, pending, refresh } = await useAuthFetch('/api/publisher/events')
```

### useCalendarViewData

Returns `{ events, categories }`. Prefers the plugin-provided `$eventsData` / `$categoriesData` to avoid duplicate fetches. EventModal also uses this so components don't re-fetch independently.

**Flows and architecture:** See [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for a map of calendar view, events data, filtering, event modal, categories, and publisher portal flows and which files they touch.

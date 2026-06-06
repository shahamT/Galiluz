# Valley luz – Code Conventions

Single source of truth for clean, production-ready code across the web app and wa-bot.

## Vue (Web App)

### Script section order

`defineOptions` (name) → `defineProps` → `defineEmits` → data (composables, stores, refs) → lifecycle hooks → computed → methods → watchers → component imports.

### Import order

NPM packages → Hooks/Services → Components → SVG/Icons, with blank lines between groups.

### Style scoping

Do not use `style scoped`. Scope styles under the component's root class using BEM:

```scss
.ComponentName {
  &-element { ... }
  &--modifier { ... }
}
```

Breakpoints via `@include mobile` imported from `~/assets/css/breakpoints`.

### Framework and utilities

Use semantic HTML. Use design tokens (CSS custom properties) and existing spacing/color variables — never hardcode values that exist as variables. Prefer existing components before creating new ones.

### Language

- **Client-side** (components, composables, stores, utils): plain JavaScript with JSDoc hints where helpful.
- **Server-side** (server/api/, server/utils/, server/consts/): TypeScript.

### CSS variables

All design tokens live in `assets/css/variables.scss`. Key namespaces:
- `--brand-*` — brand colors (dark-green, light-green, dark-blue, light-blue)
- `--spacing-*` — spacing scale (2xs → 3xl)
- `--font-size-*` — type scale (xs → 4xl)
- `--radius-*` — border radius (sm → full)
- `--color-*` — semantic colors (text, border, error, background)
- `--control-height`, `--section-header-height` — standard control heights

---

## Nuxt server (API routes + utilities)

### Route conventions

- `server/api/` routes use `defineEventHandler`.
- All publisher-facing endpoints call `requirePublisherAuth(event)` as the first line.
- All internal endpoints (called server-to-server) call `requireApiSecret(event)`.
- Respond 400 for bad input, 401/403 for auth failures, 422 for validation failures, 503 when a required service is unavailable, 500 for unexpected errors.
- Use `createError({ statusCode, message })` — never throw raw errors.

### Validation and sanitization

Before persisting any publisher-submitted event data:
1. Call `sanitizeEventFields(body)` to strip HTML from text fields and validate URLs.
2. Call `normalizePublisherFormattedEvent(event, validCategoryIds)` to normalize categories and occurrence times.
3. Call `validatePublisherFormattedEvent(event)` — throws 422 if invalid.

### Audit logging

All mutations to event documents must call the appropriate log function from `server/utils/eventLogs.service.ts`: `logEventCreation`, `logEventEdit`, or `logEventDeletion`.

---

## wa-bot

### Module layout

- **Entry:** `src/index.js`
- **Config:** `src/config.js`
- **Consts:** `src/consts/` – all user-facing copy, log prefixes, shared URLs. No business logic.
- **Routes:** `src/routes/` – HTTP surface only; delegate to flows/services.
- **Services:** `src/services/` – external APIs. Return `{ success, error? }`; no unhandled throws.
- **Flows:** `src/flows/` – conversation steps and payload building.
- **Utils:** `src/utils/` – logging, date helpers, message formatting.

### Import order

External packages → config → consts → services → flows → utils.

### Logging

Use `src/utils/logger.js` with `LOG_PREFIXES` from `src/consts/index.js`. No raw `console.log`/`console.warn`/`console.error` in application code. Keep Debug log calls; remove only temporary testing logs.

### Constants

User-facing strings (Hebrew copy, error messages) in `src/consts/index.js` or dedicated const files. No inline Hebrew in routes/flows beyond single references to consts.

### Error handling

Services return `{ success: false, error }`; log inside the service. Webhook POST: respond 200 immediately; process in background; catch and log errors.

### JSDoc

Public/service functions: brief JSDoc with `@param`, `@returns` where helpful.

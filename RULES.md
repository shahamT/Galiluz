# Valley luz – Code Conventions

Single source of truth for clean, production-ready code across the web app and wa-bot.

## Vue (Web App)

### Script section order

`defineOptions` (name) → `defineProps` → `defineEmits` → data (composables, stores, refs) → lifecycle hooks → computed → methods → watchers → component imports.

### Import order

NPM packages → Hooks/Services → Components → SVG/Icons, with blank lines between groups.

### Style scoping

Do not use `style scoped`. Scope styles under the component's root class.

### Framework and utilities

Prefer framework components (Quasar if present). Use semantic HTML when HTML is needed. Use design tokens and existing variables.

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

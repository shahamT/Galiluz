# wa-bot production code conventions

Single source of truth for wa-bot production code standards.

## 1. Module layout and structure

- **Entry:** `src/index.js` – HTTP server, health, webhook mount, shutdown handlers.
- **Config:** `src/config.js` – env loading, validation in production, no app logic.
- **Consts:** `src/consts/` – all user-facing copy, log prefixes, API version, validation limits, shared URLs. No business logic.
- **Routes:** `src/routes/` – HTTP surface only; delegate to flows/services.
- **Services:** `src/services/` – external APIs (WhatsApp Cloud API, Galiluz Nuxt), in-memory state. Return `{ success, error? }` or typed results; no thrown errors to HTTP layer.
- **Flows:** `src/flows/` – conversation steps and payload building.
- **Utils:** `src/utils/` – logging, date helpers, message formatting, webhook routing.

## 2. Logging

- **Only** use `src/utils/logger.js` with `LOG_PREFIXES` from `src/consts/index.js`. No raw `console.log`/`console.warn`/`console.error` in application code (logger and errorLogger may use console internally).
- Keep **Debug log** calls (explicit debug/troubleshooting); remove only temporary testing logs.
- Config loading may use `src/utils/errorLogger.js` to avoid circular dependency.

## 3. Constants and magic values

- User-facing strings (Hebrew copy, error messages): in `src/consts/index.js` or a dedicated const file. No inline Hebrew in routes/flows beyond single references to consts.
- Shared URLs (e.g. Galiluz base): single source – config (`config.galiluzAppUrl`) – not duplicated per service.
- Numeric limits (e.g. `MAX_MEDIA`, `BATCH_FLUSH_MS`, `EVENT_ADD_TIMEOUT_MS`): define once in consts or at top of module; document meaning.

## 4. Error handling

- Services: return `{ success: false, error }` or `{ success: false, reason }`; log inside the service. No unhandled throws to HTTP.
- Webhook POST: respond 200 immediately; process in background; catch parse/processing errors and log only.

## 5. Imports

- One import per module when combining is possible (e.g. merge two lines from same path).
- Order: external packages → config → consts → services → flows → utils.

## 6. Production-only rules

- No test-only or dev-only code active in production paths unless gated by `config.isProduction === false` (or explicit env).
- Remove or gate DEV comments and test-mode state so they do not run in production.

## 7. JSDoc

- Public/service functions: brief JSDoc with `@param`, `@returns` where it helps. Keep existing JSDoc; add for new exports.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Galiluz (galiluz.co.il) — Hebrew RTL community events calendar. Nuxt 3 monorepo: the web app lives at the root; `apps/wa-listener` + `apps/wa-bot` are WhatsApp services; `packages/event-format` is the shared event contract. MongoDB (raw driver, no ODM), Pinia, Cloudinary media, PostHog, deployed on Render.

## Commands

```bash
npm run dev:web       # Nuxt dev server (localhost:3000)
npm run build         # Production build — NEVER while the dev server is running (see gotchas)
npm test              # vitest unit suite (tests/)
npm run dev:wa        # WhatsApp listener
node scripts/cleanup-orphan-stats.js   # ad-hoc stats consistency sweep (reads .env)
```

## Documentation map

| Topic | Doc |
|---|---|
| Collections, document shapes, lifecycles, soft delete, invariants | [docs/DATA_MODEL.md](docs/DATA_MODEL.md) |
| Every API route, auth flows, rate limits, conventions | [docs/API.md](docs/API.md) |
| Pages, data flow, stores, carousels, styling, tracking | [docs/FRONTEND.md](docs/FRONTEND.md) |
| System overview + cross-cutting flows | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Deploys, env rules, backups, error visibility | [docs/PRODUCTION_OPS.md](docs/PRODUCTION_OPS.md) |
| OTP/session security, media validation, API secret | [docs/SECURITY_AND_BUDGET.md](docs/SECURITY_AND_BUDGET.md) |
| Composables index | [composables/README.md](composables/README.md) |
| WhatsApp pipeline (out of web-app scope) | [docs/EVENT_OBJECT_INTEGRATION.md](docs/EVENT_OBJECT_INTEGRATION.md), [docs/WHATSAPP_SERVICE.md](docs/WHATSAPP_SERVICE.md) |

## Hard invariants — never violate

- **Events are never hard-deleted.** Deletion = `deletedAt` + `isActive: false` on the event, then `softDeleteEventStatsData()` stamps its stats, then Cloudinary media is destroyed ([details](docs/DATA_MODEL.md)). Never call `deleteOne` on the events collection.
- **Every event read excludes soft-deleted docs** — spread `NOT_DELETED` from [server/utils/eventsQuery.ts](server/utils/eventsQuery.ts) into query filters, or guard `if (!doc || doc.deletedAt)` after `findOne`.
- **`occurrences[].startTime` is always an ISO 8601 string** (never a `Date`). Enforced by `validatePublisherFormattedEvent`; queries compare ISO strings.
- **`eventLogs` is append-only and kept forever** — it powers the publisher activity feed, including deletion entries.
- **Client-side: raw `$fetch()` has NO 401 handling.** Authenticated requests go through `useAuthFetch` (single-flight 401 → logout). If you must use `$fetch`, catch 401 yourself.

## Auth

OTP via WhatsApp → HttpOnly cookie `galiluz_auth` (1h). Roles: `publisher` | `manager` (managers act on any event; such actions are audit-flagged `isManagerAction`).

- **Local OTP testing**: in dev the OTP is never sent — it's printed in the Nuxt terminal as `[Auth][DEV] OTP for 972…: XXXXXX`. Read it from the server output.
- In dev, `requireApiSecret` no-ops when `API_SECRET` is unset locally; production refuses to boot without it ([startup-checks.ts](server/plugins/startup-checks.ts)).

## Layout & conventions

- Hebrew RTL throughout. First DOM child in a flex row = rightmost visually; reposition with CSS `order`. The vertical scrollbar sits at the screen edge via `direction: ltr` on `.AppShell-scroller` (content restores `rtl`) — see [docs/FRONTEND.md](docs/FRONTEND.md).
- Vue 3 `<script setup>`; SCSS BEM (`.ComponentName-element--modifier`); CSS custom properties in `assets/css/variables.scss`; `@include mobile` from `assets/css/breakpoints.scss`.
- `v-if` to fully hide elements; `disabled` only when the element should stay in the DOM.
- Auto-imports cover `composables/`, `stores/`, `utils/` — don't add import lines for those.
- Components register with folder prefixes: `components/publisher/DashboardKpiCard.vue` → `<PublisherDashboardKpiCard>`, `components/ui/MainMenu.vue` → `<UiMainMenu>`.

## Dev gotchas

- **Adding or deleting files in `server/plugins/` requires a full dev-server restart** — Nitro's dev build keeps a stale plugin list and every API request 500s until restart.
- **Never run `npm run build` while the dev server runs** — it clobbers `.nuxt` and the dev server dies with `EBUSY … rmdir .nuxt\dev`. Recovery: kill all node processes, delete `.nuxt`, restart `npm run dev:web`.
- The events feed is windowed: clients request `/api/events?to=YYYY-MM-DD` (rolling current month +2). If events seem "missing" in far months, check the window logic in [composables/useEvents.js](composables/useEvents.js) before suspecting the DB.

## Git flow

- Day-to-day work happens on `develop`.
- Production release: merge `develop` into `main` inside the worktree at `C:/Users/shaha/Desktop/Coding/galiluz-main-wt` (`main` is checked out there), push, then fast-forward `develop` to the merge commit and leave `develop` active.
- Never push to any remote unless explicitly asked. Render auto-deploys `main`.

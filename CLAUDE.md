# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Galiluz (galiluz.co.il) — Hebrew RTL community events calendar. Nuxt 3 monorepo: the web app lives at the root; `apps/wa-listener` (group ingestion) + `apps/wa-bot` (Cloud API webhook bot) + `apps/wa-gateway` (Green API bridge — OTP delivery, future actions) are WhatsApp services; `packages/event-format` is the shared event contract. MongoDB (raw driver, no ODM), Pinia, Cloudinary media, PostHog, deployed on Render.

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
| Env-var groups + which group attaches to which service | [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) |
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
- **Cloudflare Turnstile gates `send-otp` in production only** — dev is exempt on both client and server ([useTurnstile.js](composables/useTurnstile.js), [turnstile.ts](server/utils/turnstile.ts)), so local login never shows a captcha. Half-configured keys (one of the two) crash production startup by design.

## Accounts, roles & portals

- **Only two roles exist** — `publisher` and `manager`, stored as `type` on the `publishers` collection. **There is no separate `admin` role: managers _are_ the admins.** The session carries `type` ([requirePublisherAuth.ts](server/utils/requirePublisherAuth.ts)); gate manager-only API routes with `requirePublisherAuth(event, { requireManager: true })` (throws 403, message `manager_only`), and the client gates `/admin/**` via `authStore.isManager` in [middleware/auth.ts](middleware/auth.ts).
- **Accounts group publishers** ([accountScope.ts](server/utils/accountScope.ts)) — one account → many publishers, each publisher → exactly one account (`publishers.accountId`). **The mapping is 1:1 today**; the layer is groundwork for multi-publisher-per-business. An account is auto-created on publisher approval (`ensureAccountForPublisher`); [scripts/backfill-accounts.js](scripts/backfill-accounts.js) is the idempotent migration for legacy publishers.
- **Account scope is resolved at query time, never denormalized.** Replace a `publisherId: X` filter with `publisherId: { $in: await getAccountPublisherIds(session) }`. It falls back to `[session.publisherId]` for pre-backfill publishers, so scoping degrades to old per-publisher behaviour — never widens or empties a query.
- **Account feature flags (entitlements)** live in `accounts.features` (registry: [consts/features.const.js](consts/features.const.js); resolver: `getAccountFeatures(session)` in [accountFeatures.ts](server/utils/accountFeatures.ts)). Default **OFF/opt-in**; **managers bypass** (all-enabled) and the admin portal never checks them. **Enforce server-side** — gated read endpoints must *omit/empty the protected data* (e.g. dashboard `totals`, the event `stats` object), never rely on the UI. The client gets the resolved map via `/api/auth/me` + login → `authStore.hasFeature(key)` for UI gating only. Set flags via [scripts/set-account-features.js](scripts/set-account-features.js). First two flags: `globalStats`, `perEventStats`.
- **Dashboards share one aggregator** ([dashboardStats.ts](server/utils/dashboardStats.ts)) — publisher dashboard ([server/api/publisher/dashboard.get.ts](server/api/publisher/dashboard.get.ts)) is account-scoped; admin dashboard ([server/api/admin/dashboard.get.ts](server/api/admin/dashboard.get.ts)) is platform-wide. Both return event counts, KPI totals (views / unique visitors / interactions), top events, and a `recentLogs` activity feed sourced from `eventLogs`. UI is in `components/publisher/Dashboard*.vue`.
- **Admin portal** lives under `pages/admin/**` (dashboard, all-events list + detail, accounts placeholder) backed by `server/api/admin/{dashboard,events,publishers}.get.ts` (all manager-gated, no publisher scope on reads).
- **On-behalf publishing (managers only)** — [EventFormModal.vue](components/publisher/EventFormModal.vue) offers self / existing-publisher / new-publisher. The create route ([server/api/publisher/events.post.ts](server/api/publisher/events.post.ts)) sets `publisherId` to the target and stamps the action `isManagerAction: true` + `actingManagerPublisherId`. Unknown phone numbers become **ghost publishers** (`status: 'ghost'`, `createdOnBehalf: true`, cannot log in) — created idempotently by [ghost.post.ts](server/api/publishers/ghost.post.ts).
- **Event transfer** ([transfer.patch.ts](server/api/publisher/event/[id]/transfer.patch.ts), manager-only) reassigns `event.publisherId` (+ mirrored `rawEvent` fields), stamps `originalCreatorPublisherId` on first transfer, and appends an `event_transferred` log with `previousPublisherId`.
- **Registration** — `POST /api/publishers/register` (API-secret gated, called by the wa-bot) upserts a `status: 'pending'` publisher; approval ([approve.post.ts](server/api/publishers/approve.post.ts)) flips to `approved` and creates the account. Only `approved` publishers can receive OTP / log in. The login page shows a registration CTA modal deep-linking to the bot.

## Integrations (env-gated — unset vars silently disable)

- **WhatsApp OTP delivery** — login codes are sent via the **wa-gateway** service ([apps/wa-gateway](apps/wa-gateway)), a standalone always-on app bridging to the WhatsApp Business account through **Green API** (hosted WhatsApp HTTP gateway — no Baileys QR/auth-disk; plain HTTPS sends with no 24h-window/template restriction, so it reaches cold users). The web app's [send-otp.post.ts](server/api/auth/send-otp.post.ts) POSTs `{ phone, otp }` to the gateway's `/internal/otp` (gated by `API_SECRET`); the gateway formats the message and calls Green API. Configure with `WA_GATEWAY_URL` (web) + `GREEN_API_ID_INSTANCE`/`GREEN_API_API_TOKEN_INSTANCE` (gateway). In dev, if `WA_GATEWAY_URL` is unset the OTP still prints to the Nuxt terminal. The gateway has a generic `greenApi.service` (all actions) + an `otp.service`; it's structured to later absorb group ingestion (via a `/webhook/green-api` route) and **replace wa-listener**. The old Cloud-API text OTP path is gone (it could only reach users active in the last 24h).
- **OpenAI event extraction** — free text → form-ready event DTO via the shared `@galiluz/event-format` extractor. Web AI-generate ([server/api/publisher/event/ai-generate.post.ts](server/api/publisher/event/ai-generate.post.ts)) uses `OPENAI_MODEL_WEB` (required, no default) and a web-only system-prompt suffix (`WEB_EXTRA_INSTRUCTIONS` — rich TipTap-safe HTML, live-music categorization); the wa-bot pipeline uses `OPENAI_MODEL`. Per-publisher rate limit via `checkAiGenerateRateLimit`. No persistence — the client validates the returned DTO.
- **Zoho SMTP owner emails** ([server/utils/mailer.ts](server/utils/mailer.ts)): feedback submissions + throttled 5xx error alerts to the site owner. `SMTP_*`/`MAIL_*` env vars.
- **Cloudflare Turnstile** (above). **PostHog** analytics, **Cloudinary** media — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full external-services map.

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

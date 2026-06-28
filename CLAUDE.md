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
| **End-to-end flow docs** (per-feature journeys; write one for every new cross-cutting flow) | [docs/flows/](docs/flows/README.md) |
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

OTP via WhatsApp → HttpOnly cookie `galiluz_auth` (1h). Roles are multi-tenant RBAC via `memberships` (see **Accounts, roles & portals** below) — business `owner`/`admin` + platform `super_admin`/`viewer`. A platform `super_admin` (the old "manager") acts on any event; such cross-account actions are audit-flagged `isManagerAction`.

- **Local OTP testing**: in dev the OTP is never sent — it's printed in the Nuxt terminal as `[Auth][DEV] OTP for 972…: XXXXXX`. Read it from the server output.
- In dev, `requireApiSecret` no-ops when `API_SECRET` is unset locally; production refuses to boot without it ([startup-checks.ts](server/plugins/startup-checks.ts)).
- **Cloudflare Turnstile gates `send-otp` in production only** — dev is exempt on both client and server ([useTurnstile.js](composables/useTurnstile.js), [turnstile.ts](server/utils/turnstile.ts)), so local login never shows a captcha. Half-configured keys (one of the two) crash production startup by design.

## Accounts, roles & portals

- **Roles are multi-tenant RBAC via the `memberships` collection** (source of truth) — see [docs/DATA_MODEL.md](docs/DATA_MODEL.md) + the rollout/roadmap in [plans/multi-account-roadmap.md](plans/multi-account-roadmap.md). A publisher↔account membership carries a `role`, scoped by the account's `kind`: **business** accounts use `owner`|`admin` (functionally equal today), the single **platform** account ("Galiluz Management") uses `super_admin`|`viewer`. **`super_admin` is the new name for the old single "manager"** — managers are the platform admins. Roles are read FRESH from memberships each request and resolved through the central policy module [authz.ts](server/utils/authz.ts) (capabilities→roles) — never role-name checks scattered in handlers, never a cached role.
  - **Session** ([requirePublisherAuth.ts](server/utils/requirePublisherAuth.ts)) carries `platformRole`, `activeAccountId`/`activeRole`, and the effective `isSuperAdmin`/`isPlatformStaff` flags (no `type`). Gate routes with `requireSuperAdmin: true` (platform writes; 403 `manager_only`) or `requirePlatformStaff: true` (admin READ routes; lets a `viewer` read). Per-resource checks use `!session.isSuperAdmin && !ownsEventForSession(session, doc.event)`. Client gates `/admin/**` via `authStore.isSuperAdmin` in [middleware/auth.ts](middleware/auth.ts).
  - **Manage staff** (super_admin/viewer) with [scripts/set-platform-role.js](scripts/set-platform-role.js) — there is no admin UI yet. **`publishers.type` is legacy and no longer read for roles** (the in-bot manager/on-behalf flow that consumed it was removed). Setting `type:'manager'` by hand does nothing — create a super_admin membership instead.
- **Accounts group publishers** ([accountScope.ts](server/utils/accountScope.ts)) — one account → many publishers, each publisher → ≥1 account via memberships. **The mapping is 1:1 today**; the layer is groundwork for multi-publisher-per-business *and* a publisher in several accounts. An account + owner membership is auto-created on publisher approval (`ensureAccountForPublisher` → `ensureMembership`); [scripts/backfill-accounts.js](scripts/backfill-accounts.js) (accounts) + [scripts/backfill-memberships.js](scripts/backfill-memberships.js) (memberships + `event.accountId`) are the idempotent migrations for legacy data.
- **Scoping uses two keys.** **Events** carry the tenant key `event.accountId` (stamped at create, moved on transfer): portal event reads/ownership scope by `event.accountId === session.activeAccountId` (super-admin bypass) via `getAccountEventFilter` / `ownsEventForSession`. **Stats** rows are keyed by `publisherId`, so dashboard/stats scope by the account's publisher-set `publisherId: { $in: await getAccountPublisherIds(session) }` (resolved from memberships).
- **Account feature flags (entitlements)** live in `accounts.features` (registry: [consts/features.const.js](consts/features.const.js); resolver: `getAccountFeatures(session)` in [accountFeatures.ts](server/utils/accountFeatures.ts)). Default **OFF/opt-in**; **super-admins bypass** (all-enabled; a `viewer` does NOT bypass) and the admin portal never checks them. **Enforce server-side** — gated read endpoints must *omit/empty the protected data* (e.g. dashboard `totals`, the event `stats` object), never rely on the UI. The client gets the resolved map via `/api/auth/me` + login → `authStore.hasFeature(key)` for UI gating only. Set flags via [scripts/set-account-features.js](scripts/set-account-features.js). First two flags: `globalStats`, `perEventStats`.
- **Dashboards share one aggregator** ([dashboardStats.ts](server/utils/dashboardStats.ts)) — publisher dashboard ([server/api/publisher/dashboard.get.ts](server/api/publisher/dashboard.get.ts)) is account-scoped; admin dashboard ([server/api/admin/dashboard.get.ts](server/api/admin/dashboard.get.ts)) is platform-wide. Both return event counts, KPI totals (views / unique visitors / interactions), top events, and a `recentLogs` activity feed sourced from `eventLogs`. UI is in `components/publisher/Dashboard*.vue`.
- **Admin portal** lives under `pages/admin/**` (dashboard, all-events list + detail, accounts placeholder) backed by `server/api/admin/{dashboard,events,publishers}.get.ts` (no publisher scope on reads). Admin **read** routes gate with `requirePlatformStaff` (super_admin or viewer); admin **mutation** routes (broadcasts, crawler settings, preferences) gate with `requireSuperAdmin`.
- **On-behalf publishing (super-admins only)** — [EventFormModal.vue](components/publisher/EventFormModal.vue) offers self / existing-publisher / new-publisher. The create route ([server/api/publisher/events.post.ts](server/api/publisher/events.post.ts)) sets `publisherId` to the target and stamps the action `isManagerAction: true` + `actingManagerPublisherId`. Unknown phone numbers become **ghost publishers** (`status: 'ghost'`, `createdOnBehalf: true`, cannot log in) — created inline by that route (+ an account + owner membership via `ensureAccountForPublisher`).
- **Event transfer** ([transfer.patch.ts](server/api/publisher/event/[id]/transfer.patch.ts), super-admin-only) reassigns `event.publisherId` + `event.accountId` (+ mirrored `rawEvent` fields), stamps `originalCreatorPublisherId` on first transfer, and appends an `event_transferred` log with `previousPublisherId`/`previousAccountId`.
- **Registration is web-based** — `POST /api/publishers/register/{check,start,verify}` ([composables/useRegister.js](composables/useRegister.js)): check phone eligibility → submit details + send OTP (`start`) → verify OTP (`verify`) creates the `status:'pending'` publisher and notifies the approver(s) (via the bot's `/internal/notify-approver`). Approval ([approve.post.ts](server/api/publishers/approve.post.ts)) flips to `approved` + creates the account/owner membership. Only `approved` publishers can receive OTP / log in.
- **Approvers are DB-managed & multi** — the people who get publisher-registration / new-event WhatsApp notices and act on them are configured in the admin portal (**ניהול מאשרים**, `pages/admin/settings/approvers.vue`) as a list of `publisherId`s in `appSettings.approvers`, resolved by [server/utils/approvers.ts](server/utils/approvers.ts) → `{waId,name}` (empty → no one is notified). The wa-bot fetches `/api/internal/approvers` (cached, [approvers.service.js](apps/wa-bot/src/services/approvers.service.js)), fans every notice out to all approvers, and authorizes incoming actions by it. **Actions are atomic first-wins**: approve/reject ([approve.post.ts](server/api/publishers/approve.post.ts)/[reject.post.ts](server/api/publishers/reject.post.ts)) claim `status:'pending'`; event delete ([events/[id]/delete.post.ts](server/api/events/[id]/delete.post.ts)) claims `deletedAt` absent — each stamps the actor (`approvedBy/rejectedBy/deletedByName`) and returns `{applied}`. The winner runs the side effects + proactively notifies the other approvers; a late approver is told "כבר אושר/נדחה/נמחק על ידי X".

## Integrations (env-gated — unset vars silently disable)

- **WhatsApp OTP delivery** — login codes are sent via the **wa-gateway** service ([apps/wa-gateway](apps/wa-gateway)), a standalone always-on app bridging to the WhatsApp Business account through **Green API** (hosted WhatsApp HTTP gateway — no Baileys QR/auth-disk; plain HTTPS sends with no 24h-window/template restriction, so it reaches cold users). The web app's [send-otp.post.ts](server/api/auth/send-otp.post.ts) POSTs `{ phone, otp }` to the gateway's `/internal/otp` (gated by `API_SECRET`); the gateway formats the message and calls Green API. Configure with `WA_GATEWAY_URL` (web) + `GREEN_API_ID_INSTANCE`/`GREEN_API_API_TOKEN_INSTANCE` (gateway). In dev, if `WA_GATEWAY_URL` is unset the OTP still prints to the Nuxt terminal. The gateway has a generic `greenApi.service` (all actions) + an `otp.service`; it's structured to later absorb group ingestion (via a `/webhook/green-api` route) and **replace wa-listener**. The old Cloud-API text OTP path is gone (it could only reach users active in the last 24h).
- **OpenAI event extraction** — free text → form-ready event DTO via the shared `@galiluz/event-format` extractor. Web AI-generate ([server/api/publisher/event/ai-generate.post.ts](server/api/publisher/event/ai-generate.post.ts)) uses `OPENAI_MODEL_WEB` (required, no default) and a web-only system-prompt suffix (`WEB_EXTRA_INSTRUCTIONS` — rich TipTap-safe HTML, live-music categorization); the wa-bot uses `OPENAI_MODEL` only for main-menu intent classification (its event-extraction flow was removed). Per-publisher rate limit via `checkAiGenerateRateLimit`. No persistence — the client validates the returned DTO.
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

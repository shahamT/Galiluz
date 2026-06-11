# Production Operations

## Environments & env vars

- Local dev: `.env` at the repo root (never committed). Template: [.env.example](../.env.example).
- Production (Render): env vars are set in the Render dashboard — **never** by editing `.env` comments. The dev/prod database split is `MONGODB_DB_NAME`: `valley_luz_app_dev` locally, `valley_luz_app` in production. Switching DBs by commenting/uncommenting `.env` lines is forbidden: one un-commented line away from running dev code against production data.
- Startup fails fast in production if `OTP_SECRET`, `API_SECRET`, `MONGODB_URI`, `MONGODB_DB_NAME`, or the WhatsApp credentials are missing ([startup-checks.ts](../server/plugins/startup-checks.ts)).
- The WhatsApp apps (`apps/wa-bot`, `apps/wa-listener`) have their own env files; they share `API_SECRET` (sent as `X-API-Key`) and the Mongo connection with the web app.

## Error visibility

- Unhandled 5xx errors are logged as single-line JSON (route, status, correlationId, trimmed stack) by [error-logging.ts](../server/plugins/error-logging.ts) — searchable in Render logs.
- Every request gets an `X-Correlation-Id` (honored when sent by the WA apps) via [correlation-id.ts](../server/middleware/correlation-id.ts); eventLogs entries carry correlation ids through the event lifecycle.
- **Sentry (when ready):** create a project, set `SENTRY_DSN`, then install `@sentry/nuxt` per their Nuxt guide. Deliberately not pre-installed — without a DSN it is dead weight in the bundle.

## Backups & disaster recovery

- MongoDB Atlas: enable **continuous backups / snapshots** on the production cluster (M2+ tiers; on the free M0 tier use scheduled `mongodump` from a cron, e.g. GitHub Actions nightly to a private bucket).
- **Restore procedure (test it once before you need it):**
  1. Atlas → cluster → Backup → choose snapshot → Restore to a *new* cluster (never overwrite in place).
  2. Point a staging deploy's `MONGODB_URI` at the restored cluster and sanity-check the schedule + portal.
  3. Switch production `MONGODB_URI` in Render only after verification.
- Collections that matter most: `events`, `publishers` (everything else is logs/derived stats with TTL retention: eventInteractions 90d, authLogs 30d, raw_messages 7d).

## Rate limiting

- In-memory per instance by default; set `RATE_LIMIT_FILE_PATH` to persist across restarts. If the app ever runs multi-instance, move the store to Redis — the file store is single-instance only.

## Ship-time checklist (every production deploy)

1. CI must be green before merging (`.github/workflows/ci.yml`: unit tests + build).
2. After the deploy, verify the startup logs show `[Indexes] All indexes ensured` and `[Schema] Validators applied to events + publishers`, and that there is **no** `[Startup] FATAL: …` line (missing required env vars — [startup-checks.ts](../server/plugins/startup-checks.ts)).
3. TTL retention deletes old `eventInteractions`/`authLogs`/`raw_messages` continuously (windows in the Backups section) — no per-deploy action, but `mongodump` first if you are about to point the app at a database whose history matters.

**Data-consistency sweeps (ad-hoc, not part of a deploy):** [scripts/cleanup-orphan-stats.js](../scripts/cleanup-orphan-stats.js) re-stamps `deletedAt` on any stats docs missed by a soft delete; [scripts/migrate-starttime.js](../scripts/migrate-starttime.js) normalizes any non-ISO `startTime` values. Both read `.env` and are meant to be run locally.

**Done (history, do not redo):** the one-time startup migration ran on production on 2026-06-12 — 562 orphaned stats rows stamped, `startTime` verified 100% ISO across all 65 events — and the plugin was deleted afterwards. `startTime` is now treated as canonically ISO everywhere; the dual-format query conditions in [eventsQuery.ts](../server/utils/eventsQuery.ts) have been collapsed.

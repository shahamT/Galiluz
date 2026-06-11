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

## Ship-time checklist (next production deploy)

1. Run `node scripts/migrate-starttime.js` (dry-run, then `--apply`) against production — normalizes `occurrences.startTime` to ISO strings. Afterwards, collapse the dual-format conditions in [eventsQuery.ts](../server/utils/eventsQuery.ts).
2. Run `node scripts/cleanup-orphan-stats.js` against production — stamps stats orphaned by historical hard-deletes and sweeps soft-delete stragglers (idempotent; safe to re-run any time).
3. Verify startup logs show `[Indexes] All indexes ensured` and `[Schema] Validators applied`.
4. CI must be green (`.github/workflows/ci.yml`: unit tests + build).

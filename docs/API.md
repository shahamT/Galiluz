# API Reference

Nitro routes under [server/api/](../server/api/) (plus one server route, [/direct](../server/routes/direct.get.ts), and the [event-redirect](../server/middleware/event-redirect.ts) middleware). 39 API endpoints in four auth tiers. Document shapes and collection semantics live in [DATA_MODEL.md](./DATA_MODEL.md); deployment/env concerns in [PRODUCTION_OPS.md](./PRODUCTION_OPS.md).

## Auth guards — pick the right one

| Guard | Source | Behavior |
|---|---|---|
| `requireApiSecret(event)` | [requireApiSecret.ts](../server/utils/requireApiSecret.ts) | `X-API-Key` header (preferred) or `apiKey` query param, timing-safe compare against `API_SECRET`. In production with no secret configured → 503. **In dev with no secret configured the guard is a no-op.** |
| `requirePublisherAuth(event, opts?)` | [requirePublisherAuth.ts](../server/utils/requirePublisherAuth.ts) | Reads the `galiluz_auth` HttpOnly cookie (browser) or `Authorization: Bearer` (tools), HMACs the token, looks up `publishers.authKey` with unexpired `authKeyExpiresAt` and `status: 'approved'`. Resolves roles fresh from `memberships`. 401 on failure; `{ requireSuperAdmin: true }` → 403 `manager_only` for non-super-admins, `{ requirePlatformStaff: true }` → 403 `platform_staff_only`. Returns `{ publisherId, waId, fullName, publishingAs, activeAccountId, activeRole, platformRole, isSuperAdmin, isPlatformStaff }`. |
| `checkRateLimit(event)` | [rateLimit.ts](../server/utils/rateLimit.ts) | General tier, 429 on excess. |
| `checkAuthRateLimit(event)` + `checkPhoneRateLimit(phone)` | same | Auth tier (see below). |

### Rate limit tiers

| Tier | Limit | Store |
|---|---|---|
| General (`checkRateLimit`) | 100 req / IP / 60s | In-memory; file-backed when `RATE_LIMIT_FILE_PATH` is set |
| Auth (`checkAuthRateLimit`) | 10 req / IP / 5 min | Same file/memory split |
| Per-phone (`checkPhoneRateLimit`) | 10 req / phone / 5 min | In-memory only |

The file store ([rateLimitFileStore.ts](../server/utils/rateLimitFileStore.ts)) serializes read-modify-write through a queue; it is single-instance only.

## Conventions

- **Correlation IDs**: [correlation-id.ts](../server/middleware/correlation-id.ts) runs on every request — honors an inbound `X-Correlation-Id` matching `/^[\w-]{4,64}$/` (the WA apps send one), otherwise generates a 4-byte hex id. Stored on `event.context.correlationId`, echoed in the `X-Correlation-Id` response header, and carried into eventLogs entries. Mutating routes that pre-date the middleware generate their own 4-byte hex id for the eventLogs entry instead of reading the context.
- **Error logging**: [error-logging.ts](../server/plugins/error-logging.ts) logs every unhandled **5xx** as a single JSON line (`method`, `path`, `statusCode`, `message`, `correlationId`, 5-line stack). 4xx (validation, auth, 429) are deliberately not logged.
- **Super-admin semantics**: event ownership checks are uniformly `if (!session.isSuperAdmin && !ownsEventForSession(session, doc.event)) → 403` (own = `event.accountId === session.activeAccountId`). When a super-admin acts on another account's event, the eventLogs entry gets `isManagerAction: true`. Super-admin *stats* queries (`dashboard`, `stats`) drop the `publisherId` filter entirely; the portal events *list* and dashboard event counts/recent logs stay scoped to the super-admin's own active account.
- **Caching on public GETs**: `/api/categories` → `Cache-Control: public, max-age=86400` (static data); `/api/events` and `/api/events/[id]/meta` → `public, max-age=60`. `/direct` has `cache: false` in `nitro.routeRules`. Nothing else sets cache headers.
- **CSRF**: `send-otp` and `verify-otp` enforce `Origin` host === `Host` in production (missing Origin rejected).
- **Hebrew error messages**: validation failures on publisher-facing routes return Hebrew `message` strings (e.g. 422 from event validation) — they are shown to users as-is.

## Route tables

### Public (rate-limited, no auth)

| Method | Path | Guard | Purpose / params |
|---|---|---|---|
| GET | `/api/events` | RateLimit | Events feed. `dates=YYYY-MM-DD,...`, `categories=a,b`, `region=center\|golan\|upper`, `from=YYYY-MM-DD` (overrides default cutoff: first of current month − 5 days), `to=YYYY-MM-DD` (window upper bound). Active + not-deleted + `event != null`, limit 500, `rawEvent` excluded by projection. Cache 60s. |
| GET | `/api/events/[id]/first-occurrence` | RateLimit | First occurrence ≥ today (Israel) for redirect logic. Accepts `docId` or flat `docId-0`. |
| GET | `/api/events/[id]/meta` | RateLimit | SEO/social-card meta `{ title, shortDescription, imageUrl }` (prefers `isMain` media; video URLs become jpg thumbnails). 404 for inactive/deleted/draft. Cache 60s. |
| POST | `/api/events/[id]/interact` | RateLimit | Track `action` (`view\|share\|nav\|calendar\|link\|contact`) per `visitorId`, optional `occurrenceDate`. Refuses deleted/missing events. Counting rules in [DATA_MODEL.md](./DATA_MODEL.md#interactions-counting-rules). |
| POST | `/api/feedback` | RateLimit | `topic` (`bug\|feature\|content\|general\|other`) + `content` (10–2000 chars). Side-effect: owner notification email via [mailer.ts](../server/utils/mailer.ts) (fire-and-forget, never fails the request). |
| GET | `/api/categories` | none | Static category list. Cache 24h. |
| GET | `/api/health` | none | Liveness probe — returns instantly, no DB. |
| GET | `/direct?event=xxx` | none (server route) | 302 → `/events/daily-view?date=...&event=docId-index` at the first future occurrence; falls back to today. Same logic runs as middleware for `GET /?event=xxx`. |

### Auth (OTP login)

| Method | Path | Guard | Purpose |
|---|---|---|---|
| POST | `/api/auth/send-otp` | AuthRateLimit + per-phone + CSRF + Turnstile | Send 6-digit OTP via WhatsApp Cloud API. |
| POST | `/api/auth/verify-otp` | AuthRateLimit + per-phone + CSRF | Verify OTP, issue session, set `galiluz_auth` cookie. |
| GET | `/api/auth/me` | RateLimit + PublisherAuth | Current session `{ waId, fullName, publishingAs, type }`. |
| POST | `/api/auth/logout` | PublisherAuth | Unset `authKey`/`authKeyExpiresAt`, delete cookie, log `logout`. |

### Publisher portal (PublisherAuth)

| Method | Path | Scope | Purpose |
|---|---|---|---|
| GET | `/api/publisher/events` | Own only (managers too) | Non-deleted events list, sorted by latest occurrence desc. |
| POST | `/api/publisher/events` | Own | Create event — sanitized, normalized, validated; **inserted with `isActive: false`**. |
| GET | `/api/publisher/event/[id]` | Own + manager | Full event detail + stats (occurrence breakdown, link-click breakdown from eventInteractions). |
| PATCH | `/api/publisher/event/[id]` | Own + manager | Partial edit, merged into `event`, validated; logs `event_edited`. |
| PATCH | `/api/publisher/event/[id]/status` | Own + manager | Body `{ isActive: boolean }` — toggle; logs only when the value actually changed. |
| DELETE | `/api/publisher/event/[id]` | Own + manager | Soft delete + cascade (idempotent). See [DATA_MODEL.md](./DATA_MODEL.md#soft-delete--exact-sequence). |
| GET | `/api/publisher/dashboard` | Own; manager stats unscoped | `?filter=all\|active\|month` — event counts, totals, top 5 events, 6 recent eventLogs. |
| GET | `/api/publisher/stats` | Own; manager unscoped | Per-event stats rows, top 100 by views, titles joined from events. |
| POST | `/api/publisher/media` | Any authenticated + RateLimit | Base64 upload → Cloudinary. 20MB max; MIME + extension allowlists, double-extension rejection, magic-byte check for non-HEIC images. Returns `{ cloudinaryURL, cloudinaryData, isMain: false }`. |

### Admin (read routes → `requirePublisherAuth({ requirePlatformStaff: true })`; mutations → `{ requireSuperAdmin: true }`)

GET routes (`dashboard`, `events`, `publishers`, `whatsapp-groups`, `settings/crawler`, `crawler-publishers`, `broadcast/[id]`) allow platform staff (super_admin **or** viewer). All mutations require a super_admin.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/admin/broadcast-media` | Super-admin-only image upload for broadcasts → Cloudinary. **Image-only** (JPG/PNG/WebP), **≤5MB**, magic-byte check, folder `broadcasts`. Returns `{ cloudinaryURL }`. |
| POST | `/api/admin/broadcast` | Send a WhatsApp message to selected **approved** publishers. Body `{ publisherIds[], message, imageUrl? }`. Resolves recipients (approved, non-deleted), validates the worst-case image caption ≤1024, **creates a `broadcasts` job doc** (`status:'sending'`), then hands a compact job (template + per-recipient `{id, accountName, fullName}` + `broadcastId`) to the gateway's `/internal/broadcast`, which paces the sends. Returns `{ success, broadcastId, total }`. Personalization tags `<שם החשבון>`/`<שם המפרסם>` are replaced per recipient **by the gateway**. On gateway-dispatch failure the doc is marked `failed` → 502. |
| GET | `/api/admin/broadcast/[id]` | Live broadcast status (polled by the admin page while sending). Returns `{ status, sentCount, failedCount, recipientCount, total, completedAt }`. |
| GET | `/api/admin/settings/crawler` | Crawler settings: `{ enabled, groups[], logDecisions, logGroup:{chatId,name}\|null }`. |
| PATCH | `/api/admin/settings/crawler` | Toggle `enabled` and/or `logDecisions`. **Sets only the fields present in the body** so toggling one never wipes the other. |
| POST/DELETE | `/api/admin/settings/crawler/groups[/:chatId]` | Add / remove a watched group. |
| POST | `/api/admin/settings/crawler/log-group` | Set (or clear) the WhatsApp group that crawler **AI-decision logs** post to. Body `{ chatId, name }`; empty `chatId` clears; validates `@g.us`. |
| GET | `/api/admin/settings/approvers` | Configured approvers, resolved `{ approvers:[{publisherId,waId,name}], usingEnvFallback }`. Platform-staff readable. |
| POST/DELETE | `/api/admin/settings/approvers[/:publisherId]` | Add / remove an approver by `publisherId` (must be an approved publisher with a phone). Super-admin only. Stored as `appSettings.approvers.publisherIds`. |

> **Crawler AI-decision logging** (prod-only, opt-in) — when `logDecisions` is on **and** a log group is set, [ingest.post.ts](../server/api/internal/crawler/ingest.post.ts) posts the message + the AI verdict + reason to that group for every message that **reached the AI stage** (passed the not-too-short / approved-opted-in-publisher / not-duplicate filters): not-an-event · extraction-failed · past-event · duplicate-of-existing · draft-created. Pre-AI skips and transient AI errors are **not** logged. Guarded by `NODE_ENV === 'production'`, so the toggle/selector exist in dev but nothing is sent there. The on/off lives in the `crawler` settings doc (`logDecisions`); the target group in `logGroupChatId`/`logGroupName`.

> The gateway route **`POST /internal/broadcast`** (wa-gateway, ApiSecret) responds `202 { queued }` immediately and sends sequentially with randomized delays (`BROADCAST_*` env) — never a burst, since Green API drives an unofficial WhatsApp number. See [WHATSAPP_SERVICE.md](./WHATSAPP_SERVICE.md).

> **Operational "log" group** — `POST /internal/log` (wa-gateway, ApiSecret) `{ message, groupChatId? }` posts a plain, action-less notice. `groupChatId` (optional `<id>@g.us`) overrides the default `LOG_GROUP_CHAT_ID`; if neither is set it no-ops (`{ skipped: 'no_log_group' }`). The web helper `notifyLog(message, targetChatId?)` ([server/utils/notifyLog.ts](../server/utils/notifyLog.ts)) sends to it for: **new approved publishers** ([approve.post.ts](../server/api/publishers/approve.post.ts)), **new published events** ([notifyApproverEvent.ts](../server/utils/notifyApproverEvent.ts), alongside the approver's interactive copy), **new crawler drafts** ([ingest.post.ts](../server/api/internal/crawler/ingest.post.ts) — drafts go to the log, not the approver), and **crawler AI-decision logs** (prod-only, opt-in; `targetChatId` = the crawler's selected log group — see below). Find a group chatId via `GET /internal/groups`.

### Internal (ApiSecret)

The wa-bot's only event action is the approver deleting an event; the rest of these are
wa-gateway/raw-message endpoints. (Event **creation/editing** is the web portal + crawler only —
the in-bot publisher flows were retired.)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/events/[id]/delete` | Soft delete; body `deletionType: 'kill' \| 'user_deleted'` (default `user_deleted`) + optional `actorWaId`. **Atomic first-wins** (`findOneAndUpdate` on `deletedAt` absent) so concurrent approvers can't double-delete; stamps `deletedByWaId/Name`. Returns `{ applied:true, eventTitle, publisherPhone, actorName }` to the winner, or `{ applied:false, by }` (who deleted it) to a late caller. Called by the bot's approver delete. |
| GET | `/api/events/[id]/stats` | eventStats counters (deleted excluded; zeros when absent). Internal-only to prevent analytics enumeration. |
| POST | `/api/internal/broadcast-progress` | wa-gateway → web: reports broadcast progress `{ broadcastId, sentCount, failedIds[], done }`; updates the `broadcasts` job doc (status → `done` on `done:true`). |
| GET | `/api/whatsapp-messages` | RateLimit + ApiSecret. Recent raw_messages payloads, `?limit=` capped. |
| GET | `/api/whatsapp-media/[filename]` | RateLimit + ApiSecret. Looks up `cloudinaryUrl` in raw_messages by filename (path-traversal and regex-injection guarded), 302 → Cloudinary. |

### Publisher management (ApiSecret)

Registration is fully web-based (`/api/publishers/register/{check,start,verify}`, see the auth
section). The bot only approves/rejects (via the approver's buttons).

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/publishers/approve` | Body `{ waId, actorWaId? }`. **Atomic first-wins** claim `pending → approved` (stamps `approvedByWaId/Name`, opts into crawler drafts, ensures account/owner membership, posts the log notice). Returns `{ applied:true, publisherName, actorName }` to the winner, or `{ applied:false, resolvedStatus, by, publisherName }` (already approved/rejected, and by whom) to a late approver. |
| POST | `/api/publishers/reject` | Body `{ waId, actorWaId?, reason? }`. **Atomic first-wins** claim `pending → rejected` (stamps `rejectedByWaId/Name`) THEN cascades (soft-delete the publisher's events + stats, delete memberships, ghost-mark `createdOnBehalf` or hard-delete the doc). Returns the same `{ applied, resolvedStatus, by, publisherName }` shape. `reason` is only for the bot's message to the publisher. |
| GET | `/api/internal/approvers` | The resolved approver list `{ approvers: [{ waId, name }] }` for the wa-bot to fan out notices to and to authorize incoming approver actions. Resolves the admin-configured publisherIds (env-approver fallback when none). |

## Auth flow sequences

OTP login for the publisher portal. Phone numbers are normalized to `972XXXXXXXXX` (accepts `05X…`, `5X…`, `972…`). All hashes are `HMAC-SHA256(value, OTP_SECRET)` hex.

### 1. `POST /api/auth/send-otp` — [send-otp.post.ts](../server/api/auth/send-otp.post.ts)

1. `checkAuthRateLimit` (10/IP/5min) → CSRF origin check (prod) → Turnstile token verification ([turnstile.ts](../server/utils/turnstile.ts); skipped when `TURNSTILE_SECRET_KEY` unset; 403 `captcha_failed` / 503 `captcha_unavailable`, fail-closed) → normalize phone → `checkPhoneRateLimit` (10/phone/5min).
2. Publisher must exist with `status: 'approved'` (else 404 `not_registered`).
3. Reject if `otpBlockedUntil` is in the future (429 `blocked:<secondsLeft>`).
4. Send-count window: max 5 OTPs per phone per rolling hour (`otpSentCount`/`otpSentWindowStart`; 429 `send_limit:<minutes>`).
5. Generate 6-digit OTP, store the **hash** with `otpExpiresAt = +10min`, increment send count. **`otpAttempts` is NOT reset and `otpBlockedUntil` is NOT cleared here — by design.** Re-sending an OTP must not grant a fresh batch of guesses; the attempt counter resets only on successful login, and a block expires only naturally.
6. Send via WhatsApp Cloud API (send failure is logged, not exposed — the stored OTP stays valid). In dev, the plaintext OTP is printed to the Nuxt server terminal (`[Auth][DEV] OTP for …`). Production with missing WA credentials → 503.
7. authLogs: `otp_sent`.

### 2. `POST /api/auth/verify-otp` — [verify-otp.post.ts](../server/api/auth/verify-otp.post.ts)

1. Same rate limits + CSRF; OTP must be exactly 6 digits.
2. Publisher must be `approved`; blocked check as above (logs `blocked`); 400 `otp_expired` if no stored OTP or past `otpExpiresAt`.
3. Compare submitted hash to stored hash with `timingSafeEqual`.
4. **Mismatch**: increment `otpAttempts` (this counter survives OTP re-sends); at 5 attempts set `otpBlockedUntil = +30min`. Log `otp_failed` with `attemptsLeft`. Respond 429 `blocked:…` if now blocked, else 401 `invalid_otp:<attemptsLeft>`.
5. **Match**: generate a random 32-byte token; store its hash as `authKey` with `authKeyExpiresAt = +1h`; reset `otpAttempts: 0`; `$unset` `otp`, `otpExpiresAt`, `otpBlockedUntil`. Set the cookie:

   ```
   galiluz_auth = <plaintext token>
   httpOnly: true, secure: <prod only>, sameSite: 'strict', path: '/api', maxAge: 3600
   ```

   The token is never readable by JavaScript; only its hash is stored server-side. Returns `{ expiresAt, user: { waId, fullName, publishingAs, type } }`. Log `login`.

### 3. Session use — `GET /api/auth/me` / any PublisherAuth route

`requirePublisherAuth` hashes the cookie (or Bearer) token and looks up `{ authKey: hash, authKeyExpiresAt: { $gt: now } }` with `status: 'approved'`. There is no session refresh — after 1 hour the user logs in again.

### 4. `POST /api/auth/logout`

`$unset` `authKey`/`authKeyExpiresAt`, `deleteCookie('galiluz_auth')`, log `logout`.

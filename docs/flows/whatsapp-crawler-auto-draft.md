# WhatsApp Crawler → Auto-Draft Events

> Status: **deployed; end-to-end verified except a live OpenAI-connectivity blocker** (every `detect`/`extract` call to `api.openai.com` from the web service fails with `Premature close`, even across retries — see §11 *Open issue*). · Added 2026-06-20 · Key commits `c031cbe` (feature), `3713a60` (webhook fail-closed), `bc5edad` (gateway `WEB_APP_URL`), `46e3b1f` (OpenAI retry + dedup fix) · Owner-area: web + wa-gateway

## 1. Purpose & user story

Encourage publishers to post more events. When an **opted-in, approved** publisher
posts what looks like a **new event** in a WhatsApp group the business number
watches, the system automatically:

1. creates a **draft** event in that publisher's Galiluz account (not published), and
2. sends them a personal, single-use **magic link** on WhatsApp to review → publish.

The publisher never fills a form from scratch — they just confirm a pre-filled draft.
Everything is opt-in and admin-gated; nothing is ever auto-published.

## 2. End-to-end sequence

```
 publisher posts in a watched WhatsApp group
        │
        ▼
 Green API (hosted WhatsApp gateway)
        │  incomingMessageReceived webhook
        │  Authorization: Bearer <webhookUrlToken>
        ▼
 wa-gateway  POST /webhook/green-api          apps/wa-gateway/src/routes/webhook.js
        │  • verify webhook token (fail-closed)
        │  • group message only (@g.us)
        │  • watched-group cache filter (web is authoritative)
        │  • ack 200 immediately, then fire-and-forget:
        ▼  POST {groupChatId, senderPhone, text, imageUrl, mimeType, idMessage}
           header x-api-key: <API_SECRET>
 web  POST /api/internal/crawler/ingest        server/api/internal/crawler/ingest.post.ts
        │  enabled? group watched? sender approved+opted-in? dedup?
        │  detect(AI) → extract(AI) → match account future events(AI)
        │  image → Cloudinary (SSRF-guarded) → build draft (validDraft) → insert
        │  log → issue magic link
        ▼  POST /internal/send-message {phone, message}   header x-api-secret
 wa-gateway → Green API sendMessage → publisher's WhatsApp (magic link)
        │
        ▼
 publisher taps link → web GET /api/auth/magic-link?t=…   server/api/auth/magic-link.get.ts
        │  validate (single-use, ≤10min) → issue 1h galiluz_auth session
        ▼  302 → /publisher/events/<draftId>  (review / edit / publish / delete)
```

**Direction of the two internal hops is asymmetric** (this trips people up):
- **gateway → web** uses header `x-api-key` (web's `requireApiSecret` reads `x-api-key`).
- **web → gateway** uses header `x-api-secret` (gateway's `checkApiSecret` reads `x-api-secret`).
- Both carry the same shared `API_SECRET` value.

## 3. Components

### Admin (manage + opt-in) — manager-gated
| File | Role |
|---|---|
| [pages/admin/settings.vue](../../pages/admin/settings.vue) + [settings/index.vue](../../pages/admin/settings/index.vue), [settings/crawler.vue](../../pages/admin/settings/crawler.vue) | Settings shell (drill-in on mobile) + crawler subpage |
| [components/admin/SettingsLayout.vue](../../components/admin/SettingsLayout.vue), [SettingsAddGroupModal.vue](../../components/admin/SettingsAddGroupModal.vue) | Sidebar/subpage layout; "add group" picker |
| [components/admin/NavTabs.vue](../../components/admin/NavTabs.vue), [consts/adminSettingsNav.js](../../consts/adminSettingsNav.js) | Adds the `הגדרות` tab + settings nav registry |
| [server/api/admin/settings/crawler.get.ts](../../server/api/admin/settings/crawler.get.ts) / [.patch.ts](../../server/api/admin/settings/crawler.patch.ts) | Read / toggle `appSettings.crawler` |
| [server/api/admin/settings/crawler/groups.post.ts](../../server/api/admin/settings/crawler/groups.post.ts) / [groups/[chatId].delete.ts](../../server/api/admin/settings/crawler/groups/[chatId].delete.ts) | Add / remove a watched group |
| [server/api/admin/whatsapp-groups.get.ts](../../server/api/admin/whatsapp-groups.get.ts) | Proxies gateway `GET /internal/groups` (live group list minus already-added) |
| [server/api/admin/crawler-publishers.get.ts](../../server/api/admin/crawler-publishers.get.ts) | Publishers with the preference on |
| [server/api/admin/publisher/[id]/preferences.patch.ts](../../server/api/admin/publisher/[id]/preferences.patch.ts) | Toggle a publisher's preference (rejects ghost/unapproved) |

### Gateway (`apps/wa-gateway`)
| File | Role |
|---|---|
| [routes/webhook.js](../../apps/wa-gateway/src/routes/webhook.js) | Green API webhook: verify token (fail-closed), parse group msg, filter, forward |
| [services/crawler.service.js](../../apps/wa-gateway/src/services/crawler.service.js) | Watched-group cache (`refreshWatchedGroups`, boot + 2-min sync) + `forwardToIngest` |
| [routes/sendMessage.js](../../apps/wa-gateway/src/routes/sendMessage.js) | `POST /internal/send-message {phone, message}` → Green API send |
| [routes/groups.js](../../apps/wa-gateway/src/routes/groups.js) | `GET /internal/groups` → `getContacts(group:true)` → `[{chatId,name}]` |
| [services/greenApi.service.js](../../apps/wa-gateway/src/services/greenApi.service.js) | Green API client (`sendMessage`, `getContacts`, `getSettings`, `setSettings`) |
| [config.js](../../apps/wa-gateway/src/config.js) | Loads env **once at boot**; fail-closed on missing `API_SECRET`/Green API creds |

### Web pipeline + auth
| File | Role |
|---|---|
| [server/api/internal/crawler/ingest.post.ts](../../server/api/internal/crawler/ingest.post.ts) | **The pipeline** (§5). API_SECRET-gated; never throws — every guard returns `{processed:false, reason}` |
| [server/api/internal/crawler/watched-groups.get.ts](../../server/api/internal/crawler/watched-groups.get.ts) | `{enabled, groupChatIds}` for the gateway cache sync |
| [server/utils/appSettings.ts](../../server/utils/appSettings.ts) | `getAppSetting(key)` / `setAppSetting(key, patch, actor)` |
| [server/utils/publisherPreferences.ts](../../server/utils/publisherPreferences.ts) + [consts/preferences.const.js](../../consts/preferences.const.js) | Preference registry + resolver (`getPublisherPreferences`) |
| [server/utils/sanitizeMessageForPrompt.ts](../../server/utils/sanitizeMessageForPrompt.ts) | Strip prompt-injection / noise from message text |
| [server/utils/crawlerEventMatch.ts](../../server/utils/crawlerEventMatch.ts) | AI compare new event vs account's future events (fail-open) |
| [server/utils/buildCrawlerDraft.ts](../../server/utils/buildCrawlerDraft.ts) | Map extractor output → stored event shape; compute `validDraft` (never rejects) |
| [server/utils/safeImageFetch.ts](../../server/utils/safeImageFetch.ts) | **SSRF-hardened** fetch of the WhatsApp media URL before Cloudinary upload |
| [server/utils/magicLink.ts](../../server/utils/magicLink.ts) + [server/api/auth/magic-link.get.ts](../../server/api/auth/magic-link.get.ts) | Issue / consume single-use login links |
| [packages/event-format/freeLanguageExtract.js](../../packages/event-format/freeLanguageExtract.js) | `detectEventFromFreeText` + `extractEventFromFreeText` (shared with web AI-generate & wa-bot) |
| [packages/event-format/openaiRetry.js](../../packages/event-format/openaiRetry.js) | Shared retry classifier + backoff (treats connection drops as retryable) |
| [components/publisher/EventFormModal.vue](../../components/publisher/EventFormModal.vue), [EventDetailView.vue](../../components/publisher/EventDetailView.vue) | Draft-only "delete draft" inside the edit modal (§ draft delete) |

## 4. Data model

Collection name keys live in [nuxt.config.ts](../../nuxt.config.ts) runtimeConfig; indexes/TTLs in [server/plugins/ensure-indexes.ts](../../server/plugins/ensure-indexes.ts). See also [DATA_MODEL.md](../DATA_MODEL.md).

- **`appSettings`** (key-based, extensible) — crawler doc:
  ```js
  { key:'crawler', enabled:false,
    groups:[{ chatId:'…@g.us', name, addedAt, addedBy }],
    updatedAt, updatedBy }
  ```
- **`crawlerMessages`** (dedup) — `{ publisherId, groupChatId, textHash, createdAt }`.
  Index `{publisherId,textHash}`; **TTL `createdAt` 21d**. `textHash = sha256(text.trim().replace(/\s+/g,' '))`.
  ⚠️ Written **only after a definitive verdict** — see §8.
- **`magicLinks`** — `{ tokenHash, publisherId, target, expiresAt, usedAt, createdAt }`.
  Index `{tokenHash}`; **TTL `expiresAt` 0** (expire-at-time).
- **`publishers.preferences`** — `{ autoGenerateDraftsByCrawler: boolean }` (default false).
  Only **approved, non-ghost** publishers are eligible. Resolved map is exposed on
  `/api/auth/me` → `authStore.hasPreference(key)` (UI gating only; server re-checks).
- **events** (the wa-bot events collection) — a crawler draft:
  ```js
  { createdAt, isActive:false, validDraft:boolean,
    event:{ …publisher-portal event shape… },
    rawEvent:{ publisherId, source:'whatsapp_crawler', rawText, groupChatId } }
  ```
  `validDraft` flags whether required fields are complete; **it has no behavioral
  effect yet** (§12).

## 5. The ingest pipeline

[ingest.post.ts](../../server/api/internal/crawler/ingest.post.ts), in order. Every
guard returns HTTP 200 with `{processed:false, reason}` (never throws — a
fire-and-forget caller must not error-loop). Success returns
`{processed:true, draftId, title, validDraft, notified, publisherId, publisherName, waId}`.

| # | Step | Skip reason on failure |
|---|---|---|
| 1 | `getAppSetting('crawler').enabled === true` | `crawler_disabled` |
| 2 | `groupChatId` ends `@g.us` **and** in `crawler.groups` | `group_not_watched` |
| 3 | normalize `senderPhone` → `waId` | `bad_sender` |
| 4 | publisher `status:'approved'` (non-ghost) | `publisher_not_eligible` |
| 5 | `getPublisherPreferences(publisher).autoGenerateDraftsByCrawler === true` | `publisher_not_opted_in` |
| 6 | sanitized text non-empty | `no_text` |
| 7 | **dedup check** (`crawlerMessages.findOne`) | `duplicate` |
| 8 | `detectEventFromFreeText` (AI, `OPENAI_MODEL_WEB`=gpt-4o) | transient → `detect_error:…` (**not recorded**); genuine non-event → record + `not_event:…` |
| 9 | `extractEventFromFreeText` (AI) | transient → `extract_error:…` (**not recorded**); deterministic fail → record + `extract_failed:…` |
| — | **record dedup** (real event reached) | — |
| 10 | `matchCrawlerEvent` vs account future events (fail-open) | matched → `already_exists:<id>` |
| 11 | image → `safeFetchImage` → `uploadBufferToCloudinary` (best-effort; failure logs, draft still created) | — |
| 12 | `buildCrawlerDraftEvent` → insert draft `{isActive:false, validDraft}` | — |
| 13 | `logEventCreation('draft_created')` | — |
| 14 | `issueMagicLink(publisherId, '/publisher/events/<draftId>')` + gateway `send-message` (best-effort) | `notified:false` if it fails (draft still created) |

The account-scope for step 10 uses `getAccountPublisherIds` over `NOT_DELETED`
future events (occurrence date ≥ Israel-today).

## 6. Authentication & security

| Hop | Guard |
|---|---|
| Green API → gateway `/webhook/green-api` | `Authorization: Bearer <webhookUrlToken>` must equal `GREEN_API_WEBHOOK_TOKEN`. **Fail-closed: 503 if the token is unset** (the route is public). Constant-time compare. |
| gateway → web `/api/internal/crawler/ingest`, `/watched-groups` | `API_SECRET` via `x-api-key` (`requireApiSecret`) |
| web → gateway `/internal/*` | `API_SECRET` via `x-api-secret` (`checkApiSecret`) |
| Admin settings APIs | `requirePublisherAuth(event,{requireManager:true})` → 403 `manager_only` |
| Image fetch | [safeImageFetch.ts](../../server/utils/safeImageFetch.ts): https-only, no credentials, DNS-resolve and reject private/reserved IPs (v4+v6, incl. IPv4-mapped/NAT64/6to4 embedded-v4, link/site-local, ULA, multicast), manual per-hop redirect re-validation, body-size cap, timeout, `image/*` only |
| Magic link | 32-byte token, **HMAC-SHA256 hashed at rest** (secret `OTP_SECRET`), 10-min TTL, **single-use**, server-validated internal redirect (must start `/`, not `//`/`/\`), issues a normal 1h `galiluz_auth` session, consume endpoint rate-limited |

Defense-in-depth: the gateway's group filtering is a noise/cost trim only — the web
ingest **re-validates** enabled/group/publisher/dedup, so a stale gateway cache can
never create a wrong draft. Ghost/unapproved publishers are ignored everywhere.

## 7. Configuration

| Var | Service | Notes |
|---|---|---|
| `API_SECRET` | web + gateway (group `galiluz-core`) | shared internal secret (min 16 chars) |
| `WA_GATEWAY_URL` | web (`galiluz-app-web`) | URL of the gateway (web → gateway calls) |
| `WEB_APP_URL` | **gateway** (`galiluz-app-wa-gateway`) | URL of the web app (gateway → web). `https://galiluz.co.il`. **Required for the crawler** — without it `forwardToIngest` no-ops. |
| `GREEN_API_ID_INSTANCE`, `GREEN_API_API_TOKEN_INSTANCE` | gateway (`galiluz-int-green-api`) | Green API instance creds |
| `GREEN_API_WEBHOOK_TOKEN` | gateway (`galiluz-int-green-api`) | **Required for the crawler.** Must equal the `webhookUrlToken` set on the Green API instance. Webhook fail-closes (503) without it. |
| `OPENAI_API_KEY`, `OPENAI_MODEL_WEB` | web (`galiluz-int-openai`) | detect/extract use `OPENAI_MODEL_WEB` (gpt-4o) |
| `OTP_SECRET` | web (`galiluz-app-web`) | HMAC secret for magic-link tokens + sessions |

Full matrix: [ENVIRONMENT.md](../ENVIRONMENT.md).

**Green API instance setup** (one-time, enables delivery). The instance must have
incoming webhooks on, pointed at the gateway, with the matching token:
```
POST https://api.green-api.com/waInstance<ID>/setSettings/<API_TOKEN>
{ "incomingWebhook": "yes",
  "webhookUrl": "https://galiluz-wa-gateway.onrender.com/webhook/green-api",
  "webhookUrlToken": "<must equal GREEN_API_WEBHOOK_TOKEN>" }
```
There is a **single shared Green API instance**; its `webhookUrl` can point to only
one place at a time (e.g. prod gateway **or** a dev tunnel — not both). Verify live
settings via gateway `GET /internal/diagnostics`.

## 8. Resilience

- **OpenAI retries** ([openaiRetry.js](../../packages/event-format/openaiRetry.js)):
  `detect`/`extract` run a bounded loop (`maxRetries:0` on the SDK + own loop) and
  retry only retryable errors with backoff. Critically, `isRetryableOpenAIError`
  treats **status-less connection errors** (`Premature close`, `ECONNRESET`, socket
  hang up, fetch timeouts) as retryable — the original status-only check did not,
  which is what dropped a real event. Both functions return a `transient` flag so
  callers can distinguish a transport failure from a genuine verdict.
  ⚠️ Retry only helps a **transient** drop. If *every* attempt fails with
  `Premature close` (as observed in prod, 3/3), the cause is not load — it points to
  a connection-reuse / egress issue at the HTTP layer. See §11 *Open issue*.
- **Dedup is recorded only after a definitive verdict.** The dedup row is written
  on: genuine non-event (step 8), deterministic extract failure (step 9), or a real
  event reaching draft creation. **Transient** detect/extract errors abort
  **without** recording, so a re-post re-evaluates. (Earlier the row was written
  before the AI calls, so one transient blip suppressed the event for the whole 21-day
  TTL window — fixed in `46e3b1f`.)
- **Match is fail-open** — a transient error in step 10 returns "no match" and the
  draft is still created (the publisher reviews it anyway).
- **Notify is best-effort** — the draft is already saved; a send failure only sets
  `notified:false`.

## 9. Enablement runbook (production)

1. **Render env** — gateway service: set `GREEN_API_WEBHOOK_TOKEN` (group
   `galiluz-int-green-api`) and `WEB_APP_URL=https://galiluz.co.il` (group
   `galiluz-app-wa-gateway`). **Restart the gateway** so it re-reads env (config is
   read once at boot).
2. **Green API** — run the `setSettings` call (§7) with `webhookUrlToken` **equal to**
   `GREEN_API_WEBHOOK_TOKEN`.
3. **Admin** — at `/admin/settings` enable the crawler, add the watched group(s),
   opt in the publisher(s). (Production DB is separate from local — configure on the
   live site.)
4. **Verify** — gateway log shows `[Crawler] watched groups synced: enabled=true, N group(s)`;
   an unauthenticated `POST /webhook/green-api` returns 401, a correct-token one 200.

## 10. Testing

- **Local simulation (no Green API):** POST a synthetic `incomingMessageReceived`
  body to the local gateway `POST /webhook/green-api` (with the `Bearer` token), or
  POST a `{groupChatId, senderPhone, text, …}` body straight to the web
  `POST /api/internal/crawler/ingest` (`x-api-key`). The full pipeline runs.
  ⚠️ The success path sends a **real WhatsApp** (magic link) to the publisher.
- **Dev magic link:** in non-production the link is printed to the Nuxt terminal as
  `[Crawler][DEV] Magic link for <waId>: <link>`, so you can test without the gateway.
- **Real WhatsApp locally** needs a public tunnel (Green API can't reach
  `localhost`) — point the instance `webhookUrl` at the tunnel.
- **Dedup caveat when re-testing:** the same text within 21 days is skipped as
  `duplicate`. Use fresh event text per test (or clear the `crawlerMessages` row).

## 11. Troubleshooting

| Symptom (gateway/web log) | Cause | Fix |
|---|---|---|
| No webhook arrives at all | Green API `incomingWebhook:"no"` / `webhookUrl:""` | `setSettings` (§7); check `GET /internal/diagnostics` |
| `POST /webhook/green-api` → 401 | gateway token ≠ Green API `webhookUrlToken` | align `GREEN_API_WEBHOOK_TOKEN` with `setSettings` value |
| `POST /webhook/green-api` → 503 | `GREEN_API_WEBHOOK_TOKEN` unset (fail-closed) | set it in Render + restart gateway |
| `[Crawler] cannot forward — WEB_APP_URL/API_SECRET not configured` | `WEB_APP_URL` missing in gateway env (or set after boot) | set it + **restart** the gateway |
| `ingest → 200 {reason:"group_not_watched"}` | prod admin config differs from local | enable + add the group on the **live** site |
| `ingest → 200 {reason:"publisher_not_opted_in"}` | sender not opted-in (prod DB) | opt the publisher in via admin |
| `detect_error:…Premature close` / `extract_error:…Premature close` | OpenAI connection drop. If **3/3 attempts** fail → persistent (see *Open issue* below), not a one-off. **No dedup poisoning** (transient errors aren't recorded), so re-posting the same text re-evaluates. | resolve the connectivity issue below; meanwhile re-post triggers a fresh attempt |
| `not_event:…Premature close` (pre-`46e3b1f` only) | transient drop with no retry, mis-recorded as a non-event verdict | retry + transient-flag added in `46e3b1f` |
| Webhook works but no draft after a fix | gateway running a stale process | gateway config is boot-time only — redeploy/restart |

### Open issue — persistent `Premature close` to `api.openai.com` (prod)

**Symptom:** every `detectEventFromFreeText` attempt (all 3 retries) fails with
`Invalid response body while trying to fetch https://api.openai.com/v1/chat/completions: Premature close`,
so the crawler returns `detect_error` and no draft is created. Observed from the
**production web service**; not yet confirmed whether it reproduces locally.

**What it is _not_:** not a logic bug (the full Green API → gateway → web hop chain
works), not dedup poisoning (transient errors aren't recorded), and not fixed by the
retry (all attempts fail identically — retry only helps a one-off).

**Leading hypothesis:** undici (Node 22 global `fetch`) reusing a keep-alive socket
that the upstream/intermediary has already half-closed → `ERR_STREAM_PREMATURE_CLOSE`
on the next request. Constructing `new OpenAI()` per call does **not** help, because
undici's connection pool is **process-global**, not per-client. A flaky/egress proxy
on Render dropping idle connections would present the same way.

**Candidate next steps (need a prod test — do not deploy blind):**
1. Determine scope: does it reproduce locally? Is the publisher-facing web
   AI-generate route (same SDK/endpoint) also affected in prod, or only the crawler?
2. Configure a dedicated undici dispatcher with a short/disabled keep-alive for the
   OpenAI client — e.g. `setGlobalDispatcher(new Agent({ keepAliveTimeout: 10_000, keepAliveMaxTimeout: 10_000 }))` at web startup, or pass a custom `fetch`/dispatcher to the SDK so stale sockets aren't reused.
3. If it's Render egress, consider a longer client `timeout` + the above, or routing
   through a stable path.
Track resolution here and flip the top-of-doc Status back to **live** once verified.

## 12. Gotchas & future work

- **Gateway config is read once at boot** ([config.js](../../apps/wa-gateway/src/config.js)) — any env change needs a restart/redeploy.
- **Single shared Green API instance** — one `webhookUrl` at a time; pointing it at a dev tunnel steals delivery from prod.
- **Prod DB ≠ local DB** — admin settings (enabled/groups/opt-ins) are per-environment.
- **Asymmetric internal headers** — `x-api-key` (gateway→web) vs `x-api-secret` (web→gateway). Mixing them up yields silent 401s.
- **Draft delete placement** — the draft-only "מחיקת טיוטה" lives **inside** the add/edit modal ([EventFormModal.vue](../../components/publisher/EventFormModal.vue), `mode==='edit' && isActive===false`); active events delete from the **details page** only.
- **`validDraft` is informational only** — it flags completeness but currently has no behavioral effect (no UI/publish gating yet). Wiring it is open future work.
- **Adding/removing `server/plugins/` files needs a full dev-server restart** (general Nitro gotcha; relevant since `ensure-indexes.ts` lives there).

## Related docs
[DATA_MODEL.md](../DATA_MODEL.md) · [API.md](../API.md) · [ENVIRONMENT.md](../ENVIRONMENT.md) · [SECURITY_AND_BUDGET.md](../SECURITY_AND_BUDGET.md) · [ARCHITECTURE.md](../ARCHITECTURE.md)

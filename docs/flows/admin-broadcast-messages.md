# Admin broadcast → WhatsApp message to publishers

> Status · Added 2026-06-23 · Owner-area web + gateway

## 1. Purpose & user story
A **manager** opens `/admin/settings/broadcast-messages`, picks approved publishers (or "select all"),
optionally attaches one image, writes a WhatsApp-formatted message with personalization tags, and sends.
Each selected publisher receives the message (image as caption when attached) via **Green API**, with the
tags replaced by their own account/publisher name. Used for system updates and promotions.

## 2. End-to-end sequence
```
manager UI ──POST /api/admin/broadcast-media──▶ web ──▶ Cloudinary (image → URL)
manager UI ──POST /api/admin/broadcast───────▶ web (manager-gated)
   web: resolve approved recipients (+ ids/names), validate caption,
        INSERT broadcasts job doc {status:'sending', sentCount:0, failedIds:[]}
   web ──POST {gateway}/internal/broadcast {broadcastId, recipients[{id,phone,…}]}──▶ wa-gateway
        ──202──▶ web ──▶ UI gets {broadcastId, total} and starts polling
   wa-gateway (background, paced): for each recipient → render tags → Green API send
        ── after each msg + final ──POST /api/internal/broadcast-progress {sentCount, failedIds, done}──▶ web → updates job doc
   manager UI ──GET /api/admin/broadcast/[id] every ~2s──▶ live "נשלחו X · נכשלו Y" until status:done
```

## 3. Components
| Layer | File | Role |
|---|---|---|
| Page | [pages/admin/settings/broadcast-messages.vue](../../pages/admin/settings/broadcast-messages.vue) | Form: recipients, image, editor, send |
| Component | [components/admin/BroadcastRecipients.vue](../../components/admin/BroadcastRecipients.vue) | One-row chips multi-select + select-all + measured "+K" overflow |
| Component | [components/admin/BroadcastEditor.vue](../../components/admin/BroadcastEditor.vue) | Textarea + WA formatting toolbar + tag-insert + live preview |
| Component | [components/admin/BroadcastImageUpload.vue](../../components/admin/BroadcastImageUpload.vue) | Single image (JPG/PNG/WebP ≤5MB) → Cloudinary URL |
| Web API | [server/api/admin/broadcast.post.ts](../../server/api/admin/broadcast.post.ts) | Resolve recipients, validate, create job doc, dispatch to gateway |
| Web API | [server/api/admin/broadcast/[id].get.ts](../../server/api/admin/broadcast/[id].get.ts) | Manager-gated live status (polled) |
| Web API | [server/api/internal/broadcast-progress.post.ts](../../server/api/internal/broadcast-progress.post.ts) | ApiSecret — gateway→web per-message progress → updates the job doc |
| Web API | [server/api/admin/broadcast-media.post.ts](../../server/api/admin/broadcast-media.post.ts) | Manager-gated image upload |
| Gateway | [apps/wa-gateway/src/routes/broadcast.js](../../apps/wa-gateway/src/routes/broadcast.js) | Paced background sender + progress callbacks |

## 4. Data model
- **Reads** `publishers` (approved, non-deleted) + `accounts` (titles) to resolve `{id, waId, fullName, accountName}`.
- **Writes** one `broadcasts` job/record doc per send: `{createdBy, createdByName, recipientIds[], recipientCount, messageTemplate, hasImage, imageUrl, status:'sending'|'done'|'failed', sentCount, failedIds[], createdAt, updatedAt, completedAt}`. The gateway updates `sentCount`/`failedIds` live via the progress callback; the record is kept for future use.

## 5. Core logic
- **Tags:** `<שם החשבון>` → account name (fallback full name), `<שם המפרסם>` → full name (fallback account name).
  Literals defined identically in `broadcast.post.ts` and `broadcast.js`. Replacement happens **in the gateway**
  (compact payload: template + per-recipient names — avoids the gateway's 64KB body cap with many recipients).
- **Caption guard:** when an image is attached the message is its caption — the web rejects (400) if the
  worst-case rendered length > 1024 (WhatsApp's limit).
- **Image vs text:** image attached → `sendFileByUrl(chatId, imageUrl, fileName, renderedCaption)`; else `sendMessage(chatId, rendered)`.

## 6. Authentication & security
- Both web endpoints: `requirePublisherAuth(event, { requireSuperAdmin: true })` (403 `manager_only` otherwise); client gated by `middleware/auth.ts`.
- Web→gateway: `x-api-secret` (shared `API_SECRET`), same as OTP/crawler.
- `imageUrl` must be a `https://res.cloudinary.com/` URL (no arbitrary URL handed to Green API).
- Recipients re-filtered to `status:'approved'` server-side — never trusts the client list.

## 7. Configuration
- Reuses `WA_GATEWAY_URL`, `API_SECRET`, Cloudinary (`CLOUDINARY_*`), `GREEN_API_*`. No new required env.
- Optional gateway pacing knobs: `BROADCAST_MIN_DELAY_MS` (8000), `BROADCAST_MAX_DELAY_MS` (20000), `BROADCAST_BATCH_SIZE` (25), `BROADCAST_BATCH_PAUSE_MS` (60000).

## 8. Resilience / WhatsApp ToS
- Green API drives an **unofficial** WhatsApp number; bulk/identical/unsolicited messaging risks a **ban**.
  Mitigations: approved-only recipients (existing relationship), **personalized (non-identical)** bodies via tags,
  **sequential** sends with **randomized 8–20s delays** + a longer pause every batch.
- Gateway responds `202` then sends in the background; per-recipient errors are logged, the failed publisher id is collected in `failedIds`, and the loop continues.
- **Live progress** is polled (web `GET /api/admin/broadcast/[id]` every ~2s) — sends are ≥8s apart so polling surfaces each increment promptly, without a long-lived SSE/WS connection. Progress callbacks are best-effort; the final `done:true` report is authoritative.
- **In-memory only** — a gateway restart mid-run drops the remaining sends; the job doc then stays `sending` and the UI's **stall guard** (no change for ~120s) ends the live view (record keeps last-known counts). Acceptable v1; no resume.

## 10. Testing
- Local: log in as a manager, select 1–2 test publishers, send text-only and image+text; confirm gateway
  logs paced sends and the rendered (tag-replaced) message arrives. (wa-gateway needs Green API creds; dev sends real messages.)

## 12. Gotchas & future work
- `sentCount`/`failedIds` reflect whether **Green API accepted** the send, not WhatsApp delivered/read (would need status webhooks).
- No opt-out/suppression flag yet. The `broadcasts` record (recipientIds + failedIds + messageTemplate) is kept for future use (e.g. retry-failed, history view).
- Tag literals are duplicated in web + gateway — keep them in sync.

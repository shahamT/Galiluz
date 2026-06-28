# Approver management — multi-approver, DB-managed, first-wins

> Status · Added 2026-06-28 · Key commits a5cf086, 7d74dad · Owner-area web + wa-bot

## 1. Purpose & user story
Approvers are the people who receive **publisher-registration** and **new-event** notices on WhatsApp
and act on them (approve / reject a registration; delete a published event). They used to be a single
hard-wired phone in the wa-bot env; now a super-admin manages a **list of approvers** in the admin
portal (**ניהול מאשרים**), picked from existing approved publishers. All approvers get the same
messages and may act. The **first action wins**; later clicks on a now-stale button are ignored with a
notice (`כבר אושר/נדחה/נמחק על ידי X`), and when one approver acts the **others are proactively
notified** (`X אישר/מחק את …`).

## 2. End-to-end sequence
```
 registration verify / event publish / admin "test request"
        │  web util notifyApproverOfRegistration / notifyApproverOfEventActivation
        ▼  POST /internal/notify-approver[-event]   (x-api-secret)
 wa-bot  ── getAllApprovers() (cached from GET /api/internal/approvers) ──┐
        │  fan out: send Approve/Reject (registration) or Delete (event)  │ to EVERY approver
        ▼                                                                  │
 approver taps a button → wa-bot webhook (isApprover(from) → approver flow)
        │  POST /api/publishers/{approve|reject}  or  /api/events/[id]/delete   { …, actorWaId: from }
        ▼
 web  ATOMIC first-wins claim (findOneAndUpdate on status:'pending' / deletedAt absent) + stamp actor
        │  applied:true  → side effects (notify publisher, log) → return { publisherName/eventTitle, … }
        │  applied:false → return { by }  (who already did it)
        ▼
 wa-bot  winner: confirm to actor + notifyOtherApprovers("X handled …")
         loser:  "כבר אושר/נדחה/נמחק על ידי X"
```

## 3. Components
| File | Role |
|---|---|
| [pages/admin/settings/approvers.vue](../../pages/admin/settings/approvers.vue) | ניהול מאשרים page — pick/remove approvers (reuses `AdminPublisherSelect`) + the test-harness card |
| [server/utils/approvers.ts](../../server/utils/approvers.ts) | `getApprovers()` resolves `appSettings.approvers.publisherIds` → `{waId,name}`; `getApproverByWaId`, `resolveActorName` |
| [server/api/admin/settings/approvers.get.ts](../../server/api/admin/settings/approvers.get.ts) · [.post.ts](../../server/api/admin/settings/approvers.post.ts) · [[publisherId].delete.ts](../../server/api/admin/settings/approvers/[publisherId].delete.ts) | Admin read / add / remove (staff read, super-admin write) |
| [server/api/internal/approvers.get.ts](../../server/api/internal/approvers.get.ts) | ApiSecret: resolved `{ approvers:[{waId,name}] }` for the bot |
| [server/api/publishers/approve.post.ts](../../server/api/publishers/approve.post.ts) · [reject.post.ts](../../server/api/publishers/reject.post.ts) · [server/api/events/[id]/delete.post.ts](../../server/api/events/[id]/delete.post.ts) | Atomic, actor-aware actions returning `{ applied, by, … }` |
| [apps/wa-bot/src/services/approvers.service.js](../../apps/wa-bot/src/services/approvers.service.js) | Cached approver list (boot + 2-min refresh); `isApprover`, `getApproverName`, `getAllApprovers` |
| [apps/wa-bot/src/routes/webhook.js](../../apps/wa-bot/src/routes/webhook.js) | Fan-out, `isApprover` routing, winner/loser branch, `notifyOtherApprovers`, `finishReject`/`finishDelete` |
| [server/utils/notifyApprover.ts](../../server/utils/notifyApprover.ts) · [notifyApproverEvent.ts](../../server/utils/notifyApproverEvent.ts) | Web → bot triggers (unchanged contract; bot now fans out) |
| […/approvers/test-request.post.ts](../../server/api/admin/settings/approvers/test-request.post.ts) · [test-cleanup.post.ts](../../server/api/admin/settings/approvers/test-cleanup.post.ts) | Super-admin test harness (dummy registration + cleanup) |

## 4. Data model
- **`appSettings` key `approvers`** — `{ key:'approvers', publisherIds: string[], updatedAt, updatedBy }`.
- **`publishers`** — actor stamps written by the atomic claims: `approvedByWaId`/`approvedByName` (+ `approvedAt`), `rejectedByWaId`/`rejectedByName` (+ `rejectedAt`). Test dummies carry `isTestDummy:true`.
- **events** — delete stamps `deletedByWaId`/`deletedByName` alongside `deletedAt`/`isActive:false`.

## 5. Core logic — first-wins
Each action is a single guarded `findOneAndUpdate`, so exactly one caller wins regardless of timing /
bot restarts / instances:
- **approve**: `{ waId, status:'pending' } → status:'approved'` (+ actor, + opt into crawler drafts, + ensureAccountForPublisher). Loser reads the doc → `{ applied:false, resolvedStatus:'approved'|'rejected', by }`.
- **reject**: claim `{ waId, status:'pending' } → 'rejected'` (+ actor) FIRST, then cascade (soft-delete events+stats, ghost or hard-delete + membership/account cleanup).
- **delete**: `{ _id, deletedAt absent } → deletedAt set` (+ actor); returns `eventTitle`+`publisherPhone` so the bot needn't rely on its in-memory map.

## 6. Authentication & security
Admin reads `requirePlatformStaff`, writes `requireSuperAdmin`. `/api/internal/approvers` + the actions are ApiSecret (`x-api-key`/`x-api-secret`). The bot authorizes incoming actors via `isApprover(from)`; the web records whatever `actorWaId` the bot passes and resolves its name from the approver list.

## 7. Configuration
No env var — approvers are entirely DB-managed via **/admin/settings/approvers**. (The legacy
`PUBLISHERS_APPROVER_WA_NUMBER` env approver + its fallback were removed once the DB list was live.)
If the list is empty, no one is notified — keep at least one approver.

## 8. Resilience
Atomic DB guard is the source of truth (no in-memory races). The bot cache keeps a stale list if the web is briefly unreachable. Action responses carry the publisher/event names so the bot survives restarts and many approvers. WhatsApp can't retract already-sent buttons → the late-click guard + proactive notify cover stale messages.

## 9. Enablement runbook
On **/admin/settings/approvers**, add approvers from the publisher list. (They must be approved publishers with a phone; the site's super-admins qualify.) No deploy needed — the bot picks up the list within ~2 min.

## 10. Testing
The page has a **בדיקת זרימת מאשרים** card (super-admin): **שליחת בקשת הרשמה לבדיקה** inserts a dummy
pending publisher (`isTestDummy:true`, invalid `97299…` waId) and fires the real approver notice;
**ניקוי נתוני בדיקה** removes all dummy publishers + their accounts/memberships. With a **single**
number you can verify: notice arrives → approve/reject → clicking the stale button again → "already
…by X". True two-approver racing + the proactive "other approvers" notice need **two** real numbers.

## 11. Gotchas & future work
- A normal **reject hard-deletes** the publisher doc, so a *late reject after another reject* may be unnameable → generic "כבר טופל"; the required approved/deleted-by-X messages are always nameable (those records persist).
- The test harness tools are super-admin-gated and safe to leave in prod; remove them later if undesired.
- Per-approver 131047 re-engagement queues + the in-memory publisher-name map remain (keyed by approverWaId); the web responses now make them fallbacks rather than the source of truth.

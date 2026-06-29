# Admin · Accounts & Publishers — rollout: testing & migration checklist

Living doc for the staged build (plan: `~/.claude/plans/ok-now-i-want-quirky-balloon.md`). Update every stage.
Legend: ⚙️ migration/ops action · 🧪 manual test · ⚠️ caution.

## ⚙️ Migrations (deploy-time, one-time, marker-guarded — DELETE the plugin file on the NEXT deploy)
- **Stage 0** — [server/plugins/migrate-set-platform-owner.ts](../server/plugins/migrate-set-platform-owner.ts):
  promotes the founder (972559896278) platform membership `super_admin` → `platform_owner`. Verify prod
  logs: `[migrate:platformOwner] platform_owner set for 972559896278`. **Remove the file next deploy.**
  - Dev: the plugin runs on `npm run dev:web` startup. To promote without booting, set directly:
    `memberships { publisherId: <admin _id>, accountId: <platform _id> }.role = 'platform_owner'`.

## ⚠️ Dev caveats (this build)
- **Adding `server/plugins/*` needs a full dev-server restart** — a dev server already running when the
  Stage-0 plugin was added has a stale plugin list (API 500s) until restarted. Restart `npm run dev:web`.
- **Could not `nuxt build` to compile-verify** the new Vue pages (a dev server was on :3000). Smoke-test
  the hub in the running dev server (HMR), and run a real `npm run build` before deploying (catches any
  SCSS/SFC issue — vitest does not compile SFC/SCSS).

## Data-model additions (NO backfill required)
- `publisher.isActive` (bool; **absent = active**). `false` blocks OTP send/verify + session use.
- `account.logo` (string URL; written in Stage 2). The accounts `$jsonSchema` validator is permissive — no change.

## 🧪 Manual testing checklist
### Stage 0 — auth foundation
- [ ] Existing **super_admin** still logs in and reaches `/admin` (isSuperAdmin now includes owner).
- [ ] After migration the **founder is `platform_owner`** and keeps full admin access.
- [ ] `requireSuperAdmin` routes (e.g. event transfer) still work for super_admin AND owner.
- [ ] A publisher with `isActive:false`: cannot request OTP (404 `not_registered`), cannot verify, and an
      existing session 401s. Setting it back to active restores login.
- [ ] ⚠️ Platform-staff management + platform-account settings are now **owner-only** (no UI yet — Stage 2).

### Stage 1 — read-only hub
New endpoints (all `requirePlatformStaff` READ): `GET /api/admin/accounts`, `GET /api/admin/publishers/list`,
`GET /api/admin/approvals`. New UI: `/admin/accounts` hub (parent [pages/admin/accounts.vue](../pages/admin/accounts.vue))
with sub-tabs **Accounts · Publishers · בקשות אישור** ([AccountsSubNav.vue](../components/admin/AccountsSubNav.vue)).
- [ ] `/admin/accounts` lists accounts with publisher + event counts; platform account first; search works.
- [ ] `/admin/accounts/publishers` lists publishers with account, role chips (platform + business), status,
      מושהה badge for inactive, #events; search (name/phone) + status filters (הכל/מאושרים/ממתינים/מושהים).
- [ ] `/admin/accounts/approvals` lists pending registrations (oldest first) with phone/email/types/date;
      empty state when none. (Approve/deny buttons arrive in Stage 3.)
- [ ] Sub-tabs highlight the active tab; mobile = card rows + horizontally-scrollable sub-tabs; RTL correct.
- [ ] Counts match reality (spot-check one account's publisher/event totals).
### Stage 2 — account detail + roles + logo
New endpoints: `GET /api/admin/account/[id]` (read, staff); `PATCH /api/admin/account/[id]` (title + features;
platform→owner, business→super_admin); `PATCH /api/admin/account/[id]/members` (setRole|add|remove, guarded
by `validateMemberChange`); `POST /api/admin/account/[id]/logo` (Cloudinary, ≤2MB). UI: `pages/admin/account/[id].vue`
(standalone, reached by clicking an account row). Guard unit-tested ([accountMembers.test.ts](../tests/accountMembers.test.ts), 11 tests).
- [ ] Click an account → detail loads (logo/title/kind/event-count/created; members with roles).
- [ ] **Business account (single-owner model)**: edit title saves; toggle feature flags persists.
      Members are **added as admin only** (no owner option on add). The owner row is **locked** (chip,
      no select/remove). **Promoting an admin → owner TRANSFERS ownership** (confirm dialog; the previous
      owner auto-becomes admin). The owner can't be demoted/removed directly.
- [ ] **A publisher can't be removed from their LAST account** — removing their only membership is blocked
      ("חייב להיות לפחות חשבון אחד"); removing an admin who belongs to another account works.
- [ ] **Logo upload** (≤2MB image) shows on the detail + back in the accounts list avatar.
- [ ] **Platform account** ("Galiluz Management"): as the **owner** you can add/remove super_admin/viewer staff
      and toggle their role; the **platform_owner row is immutable** (no select/remove). As a non-owner
      super_admin, the edit controls are hidden and the server rejects writes (403).
- [ ] A **viewer** sees the detail read-only (no edit controls).
⚙️ No new migration. Uses the `account.logo` field (added Stage 0).

### Stage 2b — delete account (`POST /api/admin/account/[id]/delete`)
- [ ] **Platform account** ("Galiluz Management") shows NO delete control; the endpoint 403s (`cannot_delete_platform`).
- [ ] **Empty business account** (no members) → "מחיקת החשבון" confirm → soft-deleted, vanishes from the list.
- [ ] **Business account with members** → must pick a **target business account**; on delete every member is
      moved there with the SAME role (the **owner becomes admin**; an already-existing target role is never
      downgraded), the account's live events move too (`event.accountId` → target), then the source is soft-deleted.
- [ ] After delete you land back on `/admin/accounts`; the moved members + events appear under the target.
### Stage 3 — approvals queue actions + badge
Refactor: the atomic approve/reject core moved to [server/utils/publisherApproval.ts](../server/utils/publisherApproval.ts);
the wa-bot endpoints (`publishers/approve.post.ts`, `reject.post.ts`) are now thin wrappers (⚠️ regression-check
the WhatsApp approve/reject flow still works). New: `POST /api/admin/approvals/[id]/{approve,reject}`
(session, super_admin/owner), `GET /api/admin/approvals/count`. Badge via shared
[useApprovalsCount.js](../composables/useApprovalsCount.js) on the top nav tab + the בקשות-אישור sub-tab.
- [ ] A pending count shows as a red badge on the **חשבונות ומפרסמים** nav tab and the **בקשות אישור** sub-tab.
- [ ] Approve a request → publisher becomes approved, account+owner membership created, opted into crawler,
      owner notified; the row disappears and the badge decrements (list + badge refresh).
- [ ] Reject a request → cascade (events/stats soft-deleted; ghost or hard-delete) runs; badge decrements.
- [ ] Concurrent safety: if a WhatsApp approver already acted, the portal shows "כבר אושרה/טופלה".
- [ ] A **viewer** sees the queue but NO Approve/Deny buttons; the endpoints 403 a viewer.
- [ ] ⚠️ Regression: the **wa-bot** approve/reject (WhatsApp) still works after the core refactor.
### Stage 4 — publisher lifecycle
New: `GET /api/admin/publisher/[id]` (detail + accounts/roles + #events); `PATCH …/[id]/active`
(deactivate/reactivate); `POST …/[id]/delete` (silent delete + bulk event transfer). UI:
`pages/admin/publisher/[id].vue` (reached by clicking a publisher row). Add/remove-to-account reuse the
Stage-2 account members endpoint. ⚙️ Publishers can now carry `deletedAt` (soft-delete) — list/detail
endpoints already exclude via `NOT_DELETED`; no backfill.
- [ ] Click a publisher → detail (profile, accounts+roles, #events).
- [ ] **Deactivate** → publisher can't OTP-login + live session 401s; **reactivate** restores. Can't
      deactivate **yourself** or the **platform owner** (buttons hidden for owner; server guards anyway).
- [ ] **Add to a (business) account** as admin; **remove from an account** — blocked if it's their LAST.
- [ ] **Delete + transfer**: pick a target publisher → all their events move to that publisher + account
      (event.publisherId/accountId reassigned, `event_transferred` logged), the publisher is soft-deleted
      (vanishes from the list), and its now-empty account is released. Silent (no WhatsApp). Can't delete
      yourself or the owner. Verify the target's event count grew by the moved count.
### Stage 5 — communicate (basic 2-way chat, no storage)
**wa-gateway** (separate service — needs its own restart/redeploy): new `getChatHistory` wrapper +
`POST /internal/chat-history` (privacy-safe logging: count only). **Web**: `GET /api/admin/chat/[publisherId]/history`
(staff read) + `POST …/send` (super_admin) via [waGateway.ts](../server/utils/waGateway.ts). UI:
[PublisherChatModal.vue](../components/admin/PublisherChatModal.vue), opened by "שליחת הודעה" on the publisher detail.
- [ ] Publisher detail → "שליחת הודעה" opens a WhatsApp-like modal; recent DMs load (out=right, in=left, RTL).
- [ ] "טען הודעות נוספות" loads older; sending a message posts it and the thread refreshes.
- [ ] ⚙️ Requires the **wa-gateway redeployed** (new route) + `WA_GATEWAY_URL` set (already set for OTP). In
      dev without a reachable gateway the modal shows "שגיאה בטעינת ההיסטוריה" — expected.
- [ ] Phones are scrubbed in dev, so real history only exists for the kept-real admin/approver numbers.

### Audit/seal pass — orphans & deletion/transfer edge cases (done)
- [ ] **Magic-link** no longer logs in a deactivated/soft-deleted publisher (→ /login).
- [ ] **Crawler** skips a deactivated/soft-deleted opted-in publisher (`publisher_not_eligible`).
- [ ] **Approvers**: deactivated approver still appears in admin list marked **מושהה** but gets NO notices /
      can't authorize (resolver excludes inactive/deleted); deleting a publisher `$pull`s them from the list.
- [ ] **Crawler list**: deleting a publisher removes them (pref off + `NOT_DELETED`); deactivating keeps them.
- [ ] **Transfer/delete moves stats**: after per-event transfer OR publisher-delete, the moved events'
      views/interactions follow the new owner's dashboard (no stats left on the old/deleted publisher).
- [ ] Publisher-delete **rejects a deactivated target**; transfer-target picker hides deactivated publishers.
- [ ] Account-delete never leaves an **ownerless** target; removing a member **repoints** their default account.
- [ ] **Deleted publisher re-registration**: entering a soft-deleted publisher's phone on `/register` shows
      "מספר זה נמחק מהמערכת, צרו אתנו קשר על מנת לשחזר את החשבון:" + the support number `055-9896278`
      (wa.me link). Gated at both the phone-check step and the `start` submit (`classifyRegistrationPhone`
      → `'deleted'`). The support number is `SUPPORT_WHATSAPP_NUMBER` (const, not env) — same as "צרו קשר".

### RBAC re-audit — three-tier roles (owner / super_admin / viewer)
Backend gate fixes: **platform-staff lifecycle is owner-only** (deactivate/delete a super_admin/viewer →
`requirePlatformOwner`; the owner is never deactivatable/deletable; self-deactivate blocked); **approvers
config → owner-only** (the 5 `settings/approvers/*` endpoints). Crawler + broadcasts stay super_admin.
Client: `/admin` now admits **viewers** (middleware → `isPlatformStaff`) with sub-area guards (settings →
super_admin; approvers → owner); mutation controls hidden per role across events (`canManage`/`showAdd`),
publisher lifecycle (`canManageLifecycle`), settings nav (`useAdminSettingsNav`), and the new pages.
- [ ] **As a viewer**: can open /admin and read dashboard/events/accounts/publishers/approvals; sees NO
      Approve/Deny, NO account/member/logo/role controls, NO event add/edit/delete/transfer, NO Settings tab.
- [ ] **As a non-owner super_admin**: manages business accounts/publishers/approvals/events + crawler +
      broadcasts; CANNOT see/edit the platform account, platform staff, or approvers config; CANNOT
      deactivate/delete another super_admin/viewer (403 `platform_staff_owner_only`; buttons hidden).
- [ ] **As the owner**: everything, incl. approvers config + platform staff + staff lifecycle.
- [ ] Publisher portal unchanged (shared EventViewSwitch/DetailView/SearchBar default to full controls).
- ⚙️ Set roles for testing with `scripts/set-platform-role.js <phone> <viewer|super_admin>` (owner = the
      migrated founder). After deploy, re-confirm the matrix.

## Deploy checklist (when shipping this feature)
1. `npm run build` must pass (SFC/SCSS) — vitest doesn't compile those.
2. **Redeploy wa-gateway** for the chat route (`/internal/chat-history`).
3. The Stage-0 `migrate-set-platform-owner.ts` runs once on web boot → then **delete that plugin file** next deploy.
4. Regression-check the **WhatsApp approve/reject** flow (Stage-3 core refactor).

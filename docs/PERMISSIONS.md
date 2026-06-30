# Permissions & Roles

Who can do what, and exactly which resources each permission touches. This is the **authoritative, code-derived** reference for the RBAC model — the security boundary is the **server** (route gates + per-resource checks); the client only hides controls.

- **Source of truth for roles:** the `memberships` collection (one row per publisher↔account, carrying a `role`). Roles are read **fresh from memberships on every request** — never cached (a stale privilege cache is the classic multi-tenant escalation bug).
- **Policy module:** [server/utils/authz.ts](../server/utils/authz.ts) maps **capabilities → roles** (pure, unit-tested). Handlers never check role *names* directly for the platform plane; they use the gates below.
- **Session shape:** [server/utils/requirePublisherAuth.ts](../server/utils/requirePublisherAuth.ts) resolves each request into a `PublisherSession` carrying `activeAccountId`/`activeRole` (business plane), `platformRole` (platform plane), and the effective flags `isSuperAdmin` / `isPlatformStaff` / `isPlatformOwner`.

Related docs: [DATA_MODEL.md](DATA_MODEL.md) (memberships/accounts shapes), [API.md](API.md) (every route), [SECURITY_AND_BUDGET.md](SECURITY_AND_BUDGET.md) (sessions/OTP). Note: **feature entitlements** (`accounts.features`, e.g. `globalStats`) are a *separate* axis — they gate data visibility, not actions — see [accountFeatures.ts](../server/utils/accountFeatures.ts); not covered here.

---

## Authentication: staff need a second factor (passkey)
Authorization (below) decides *what* a role can do; authentication decides *who gets in*. Publishers log in with **WhatsApp OTP** alone. **Platform staff** (anyone with a `platformRole`) must additionally present a **WebAuthn passkey** every login — true MFA, enforced at login:
- `verify-otp` mints a session for publishers as today, but for staff returns `{ mfaRequired }` + a short-lived pre-auth token (no usable session yet); `verify-passkey` completes the assertion and only then issues the real session. Magic-link login is refused for staff (no passkey bypass).
- **Per-staffer auto-migrate:** a staffer with no passkey can log in via OTP once but is forced to enroll at `/admin/settings/security` (ניהול → "מפתחות הגישה שלי", a settings page open to all platform staff incl. viewer) before using the portal (`mfaEnrollRequired`); after enrolling ≥1, the passkey is required.
- **Recovery:** the `platform_owner` resets a staffer's passkeys ([admin/publisher/[id]/reset-passkeys.post.ts](../server/api/admin/publisher/[id]/reset-passkeys.post.ts), owner-only) → they re-enroll OTP-only next login; [scripts/reset-passkeys.js](../scripts/reset-passkeys.js) is the owner's break-glass. Implementation: [server/utils/webauthn.ts](../server/utils/webauthn.ts) + `server/api/auth/passkey/*`.

---

## Two planes

Permissions live on two **disjoint** planes. A single person can hold roles on both (e.g. a business owner who is also Galiluz staff); their effective capabilities are the **union**.

| Plane | Scope | Roles | Every use is… |
|---|---|---|---|
| **Account** (business) | The caller's **active business account** only | `owner`, `admin` | normal tenant action |
| **Platform** (Galiluz management) | **Cross-tenant** — any account | `platform_owner`, `super_admin`, `viewer` | audited; cross-account event actions are flagged `isManagerAction` |

> The **tenant boundary** ("does the caller belong to the account that owns this resource?") is checked by the handler *before* an account-plane capability is consulted. `authz.ts` only answers "does this role set grant this capability".

---

## Roles at a glance

| Role | Plane | What it is | Effective flags |
|---|---|---|---|
| **`owner`** | account | Business account owner. **Today `owner` and `admin` are functionally identical** (both grant only `MANAGE_EVENTS`). | — |
| **`admin`** | account | Business account admin. | — |
| **`viewer`** | platform | Read-only Galiluz staff — can open the whole admin portal, **mutate nothing**. | `isPlatformStaff` |
| **`super_admin`** | platform | Galiluz operational staff (the old "manager"). Everything operational across **all business accounts**, but **no platform governance**. | `isSuperAdmin`, `isPlatformStaff` |
| **`platform_owner`** | platform | The single platform owner. **Strict superset of `super_admin`** + platform governance (manage staff + the platform account's settings). | `isPlatformOwner`, `isSuperAdmin`, `isPlatformStaff` |

`isSuperAdmin` is true for **both** `super_admin` and `platform_owner` (owner is a superset). `isPlatformStaff` is true for all three platform roles.

**Setting roles** (no admin UI for platform roles yet): [scripts/set-platform-role.js](../scripts/set-platform-role.js) for platform staff; business `owner`/`admin` are managed via the account-members route / auto-created on approval. `publishers.type` is **legacy and never read** for roles.

---

## Capabilities → roles

Defined in [authz.ts](../server/utils/authz.ts) (`CAPABILITIES` / `ROLE_CAPABILITIES`). ✓ = granted.

| Capability | What it touches | `viewer` | `super_admin` | `platform_owner` | `owner`/`admin` |
|---|---|:--:|:--:|:--:|:--:|
| `VIEW_ADMIN` | Read the admin portal (dashboards, all events, stats, lists) | ✓ | ✓ | ✓ | — |
| `MANAGE_EVENTS_ANY` | Edit / delete / change status of **any** account's event | — | ✓ | ✓ | — |
| `TRANSFER_EVENT` | Reassign an event to another publisher/account | — | ✓ | ✓ | — |
| `MANAGE_BROADCASTS` | Send broadcasts | — | ✓ | ✓ | — |
| `MANAGE_CRAWLER` | Crawler settings, groups, log-group | — | ✓ | ✓ | — |
| `APPROVE_PUBLISHERS` | Approve / reject pending registrations | — | ✓ | ✓ | — |
| `MANAGE_ACCOUNTS` | Manage **business** accounts + their publishers/account-roles | — | ✓ | ✓ | — |
| `MANAGE_PLATFORM` | Manage **platform staff** + the **platform account's** settings | — | — | ✓ | — |
| `MANAGE_EVENTS` | Create / edit / delete the **active account's own** events | — | — | — | ✓ |

Two governance powers are **owner-only but enforced directly at the route gate** (no dedicated capability): **approvers configuration** and the **lifecycle (deactivate/delete) of a platform staffer**. See the matrix below.

---

## The three platform gates

Passed as options to `requirePublisherAuth(event, { … })` ([requirePublisherAuth.ts](../server/utils/requirePublisherAuth.ts)). Any authenticated, **active**, `approved` publisher passes with no option; deactivated publishers (`isActive === false`) cannot hold a session at all.

| Gate option | Passes for | 403 message |
|---|---|---|
| `requirePlatformStaff: true` | `platform_owner` / `super_admin` / `viewer` | `platform_staff_only` |
| `requireSuperAdmin: true` | `platform_owner` / `super_admin` | `manager_only` |
| `requirePlatformOwner: true` | `platform_owner` | `platform_owner_only` |

**Per-resource checks layered on top of the gate:**
- **Own events (account plane):** `ownsEventForSession(session, doc.event)` (tenant key `event.accountId === session.activeAccountId`), with a `session.isSuperAdmin` **bypass** so platform staff act on any event.
- **Account governance (`requirePlatformStaff` gate + plane split):** for the **platform** account → require `isPlatformOwner` (`platform_owner_only`); for a **business** account → require `isSuperAdmin` (`manager_only`). A `viewer` therefore reads but never writes.
- **Platform-staff lifecycle (`requireSuperAdmin` gate + owner escalation):** can't act on yourself; the `platform_owner` is never deactivatable/deletable; acting on **any** platform staffer (super_admin/viewer) requires `isPlatformOwner` (`platform_staff_owner_only`).

---

## Publishers (business `owner` / `admin`)

A publisher acts **only within their active business account**. Events are scoped by the tenant key `event.accountId`; dashboard/stats are scoped by the account's publisher set (`publisherId ∈ getAccountPublisherIds`).

**Can:**
- Log in (OTP), read `/api/auth/me`, log out.
- View their own **dashboard** + **stats** ([dashboard.get](../server/api/publisher/dashboard.get.ts), [stats.get](../server/api/publisher/stats.get.ts)) — *data is further gated by account feature entitlements*.
- List their own events ([events.get](../server/api/publisher/events.get.ts)); read/edit/delete/change status of an event **they own** ([event/[id].get](../server/api/publisher/event/[id].get.ts), [.patch](../server/api/publisher/event/[id].patch.ts), [.delete](../server/api/publisher/event/[id].delete.ts), [status.patch](../server/api/publisher/event/[id]/status.patch.ts)) — enforced by `ownsEventForSession`.
- Create an event for **themselves** ([events.post](../server/api/publisher/events.post.ts)); AI-generate a draft from free text ([ai-generate.post](../server/api/publisher/event/ai-generate.post.ts), rate-limited); upload media ([media.post](../server/api/publisher/media.post.ts)).

**Cannot:**
- Touch another account's events (403 unless they own it).
- **Transfer** an event ([transfer.patch](../server/api/publisher/event/[id]/transfer.patch.ts) → `requireSuperAdmin`).
- **Publish on behalf of** another publisher — the create route accepts a target publisher only for `super_admin` (unknown phone → a *ghost publisher*); a plain publisher's create is always self.
- Open `/admin/**` or any admin/platform route (all require a platform gate).

> Soft-delete invariant: deleting an event sets `deletedAt` + `isActive:false`, stamps stats, destroys media — never a hard delete. See [DATA_MODEL.md](DATA_MODEL.md).

---

## Platform staff (`viewer` / `super_admin` / `platform_owner`)

Cumulative — each tier adds to the one before.

### `viewer` — read-only
Opens the entire admin portal and reads everything (`VIEW_ADMIN`), **mutates nothing**. Every admin **read** route (`requirePlatformStaff`) admits a viewer; every mutation route rejects one.

### `super_admin` — operational, all business accounts
Everything `viewer` can read, **plus** all cross-account operations:
- **Any event:** edit / delete / status / **transfer** (`MANAGE_EVENTS_ANY` + `TRANSFER_EVENT`); on-behalf event creation (incl. ghost publishers). Cross-account actions are stamped `isManagerAction` + `actingManagerPublisherId`.
- **Approvals:** approve / reject pending registrations (`APPROVE_PUBLISHERS`).
- **Broadcasts** (`MANAGE_BROADCASTS`) and **crawler** settings/groups (`MANAGE_CRAWLER`).
- **Business accounts** (`MANAGE_ACCOUNTS`): edit account title + **feature entitlements**, manage account members/roles, account logo, **delete** a business account, deactivate/delete **regular** publishers, edit publisher preferences, admin chat (send).

**Cannot:** anything on the **platform** plane — edit the platform account, add/remove/re-role platform **staff**, configure **approvers**, or change the lifecycle of another platform staffer (all → `platform_owner_only` / `platform_staff_owner_only`).

### `platform_owner` — adds platform governance (`MANAGE_PLATFORM`)
Everything `super_admin` can do, **plus** the owner-only governance:
- Edit the **platform account** (title/logo) and manage its **staff memberships** (add/remove/re-role `super_admin`/`viewer`) — [account/[id].patch](../server/api/admin/account/[id].patch.ts), [members.patch](../server/api/admin/account/[id]/members.patch.ts), [logo.post](../server/api/admin/account/[id]/logo.post.ts) when the account `kind === 'platform'`.
- **Deactivate / delete a platform staffer** — [publisher/[id]/active.patch](../server/api/admin/publisher/[id]/active.patch.ts), [delete.post](../server/api/admin/publisher/[id]/delete.post.ts) when the target is platform staff. The `platform_owner` itself is **immutable** (`cannot_deactivate_owner` / `cannot_delete_owner`), and the single-owner invariant is enforced by `validateMemberChange` ([accountMembers.ts](../server/utils/accountMembers.ts)).
- **Configure approvers** — [settings/approvers.get/.post](../server/api/admin/settings/approvers.post.ts), [[publisherId].delete](../server/api/admin/settings/approvers/[publisherId].delete.ts), and the test-request/test-cleanup helpers (all `requirePlatformOwner`).

---

## Route → required permission matrix

**Admin / platform routes** (`server/api/admin/**`):

| Route | Method | Gate | Extra check |
|---|---|---|---|
| `dashboard`, `events`, `publishers`, `publishers/list`, `accounts`, `account/[id]`, `publisher/[id]`, `approvals`, `approvals/count`, `whatsapp-groups`, `crawler-publishers`, `settings/crawler`, `broadcast/[id]`, `chat/[publisherId]/history` | GET | `requirePlatformStaff` | read-only (viewer OK) |
| `account/[id]` | PATCH | `requirePlatformStaff` | plane: platform→owner, business→super_admin |
| `account/[id]/members` | PATCH | `requirePlatformStaff` | plane split + member invariants |
| `account/[id]/logo` | POST | `requirePlatformStaff` | plane split |
| `account/[id]/delete` | POST | `requireSuperAdmin` | — |
| `approvals/[id]/approve`, `approvals/[id]/reject` | POST | `requireSuperAdmin` | atomic first-wins claim |
| `broadcast`, `broadcast-media` | POST | `requireSuperAdmin` | — |
| `settings/crawler` | PATCH | `requireSuperAdmin` | — |
| `settings/crawler/groups`, `groups/[chatId]`, `crawler/log-group` | POST/DELETE | `requireSuperAdmin` | — |
| `publisher/[id]/active` | PATCH | `requireSuperAdmin` | staff target ⇒ owner-only; self & owner blocked |
| `publisher/[id]/delete` | POST | `requireSuperAdmin` | staff target ⇒ owner-only; self & owner blocked |
| `publisher/[id]/preferences` | PATCH | `requireSuperAdmin` | — |
| `chat/[publisherId]/send` | POST | `requireSuperAdmin` | — |
| `settings/approvers` | GET/POST | `requirePlatformOwner` | — |
| `settings/approvers/[publisherId]` | DELETE | `requirePlatformOwner` | — |
| `settings/approvers/test-request`, `test-cleanup` | POST | `requirePlatformOwner` | — |

**Publisher / account routes** (`server/api/publisher/**`, `server/api/auth/**`):

| Route | Method | Gate | Extra check |
|---|---|---|---|
| `auth/me`, `auth/logout` | GET/POST | any auth | — |
| `publisher/dashboard`, `stats`, `events` | GET | any auth | account-scoped; data gated by entitlements |
| `publisher/events` | POST | any auth | on-behalf target ⇒ `super_admin` only |
| `publisher/event/[id]` | GET/PATCH/DELETE | any auth | `ownsEventForSession` (super_admin bypass) |
| `publisher/event/[id]/status` | PATCH | any auth | `ownsEventForSession` (super_admin bypass) |
| `publisher/event/[id]/transfer` | PATCH | `requireSuperAdmin` | — |
| `publisher/event/ai-generate` | POST | any auth | per-publisher rate limit |
| `publisher/media` | POST | any auth | — |

---

## Client gating (UI only — not a boundary)

The client mirrors these rules to hide controls, but **never** to enforce them. Key gates:
- `/admin/**` access: [middleware/auth.ts](../middleware/auth.ts) admits `isPlatformStaff` (viewers included).
- `authStore` exposes `isSuperAdmin` / `isPlatformStaff` / `isPlatformOwner` ([stores/auth.store.js](../stores/auth.store.js)) for component-level gating.
- Settings nav filtered by role (crawler/broadcasts → super_admin; approvers → owner); admin events list hides add/edit/delete/status/transfer from viewers; publisher-detail lifecycle buttons hide for staff targets unless owner.

Any UI that forgets to hide a control is **not** a vulnerability — the server gate rejects it. Conversely, never rely on the client to withhold gated *data*; the server endpoints omit/empty protected data themselves.

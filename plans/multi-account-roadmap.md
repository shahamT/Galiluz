# Multi-account RBAC — roadmap & rollout

Tracks the multi-tenant RBAC refactor (publishers ↔ accounts ↔ roles via a `memberships`
join table; `event.accountId` tenant key; Galiluz management as a single `platform` account).
Data model: [docs/DATA_MODEL.md](../docs/DATA_MODEL.md) (`accounts`, `memberships`, `event.accountId`).
Policy module: [server/utils/authz.ts](../server/utils/authz.ts).

## Why
The old identity model was rigid: `publishers.accountId` was a hard 1:1 link, the only
cross-cutting privilege was `publishers.type === 'manager'` (branched in ~30 places), and
events carried no account key. That blocked (a) per-account roles, (b) a publisher in >1
account, and (c) a real Galiluz management team with its own roles. The refactor moves to the
standard multi-tenant RBAC pattern with **no end-user UX change**, rolled out expand→migrate→contract
so each deploy is safe alone on continuously-deployed prod.

## Rollout status

- [x] **Deploy 1 — EXPAND (committed, behavior-identical).** `memberships` collection + indexes/validators;
      `accounts.kind`; `event.accountId` index + validator; central `authz.ts` policy module (+ tests);
      session derives `platformRole`/`activeAccountId`/`activeRole` fresh from memberships (legacy
      `type==='manager'` still counts as super_admin during rollout); dual-write owner/super_admin
      memberships on approval/ghost/on-behalf/transfer; `event.accountId` stamped on every create path
      and moved on transfer; `managers.get` tolerant (membership OR `type`). **Reads unchanged.**
- [x] **MIGRATE — data-only (DONE on prod).** [scripts/backfill-memberships.js](../scripts/backfill-memberships.js)
      (`--dry-run` first → verify counts → apply → re-run expecting 0). Creates the platform account,
      `super_admin` memberships for managers, `owner` memberships for accounted publishers, accounts for
      accountless event-owners, and stamps `event.accountId` on every non-deleted event (orphans reported,
      never guessed). Idempotent.
      Ran on prod automatically via a one-time startup hook (`server/plugins/migrate-memberships.ts`,
      marker `migration_memberships_v1`): **`[migrate-memberships] done — superAdmins:1, owners:69,
      eventsStamped:117, orphans:3`**. The hook was REMOVED in the follow-up deploy; the standalone
      script remains for manual/dry-run use. (Dev clone earlier: 1 / 67 / 115 / 3.)
- [x] **Deploy 2 — SWITCH READS (code committed; ships after the prod backfill).** `getAccountPublisherIds`
      reads memberships; event reads/ownership use `event.accountId === session.activeAccountId` (super_admin
      bypass, straggler fallback to the publisher-set); per-event/dashboard/stats gating uses
      `session.isSuperAdmin`; admin reads → `requirePlatformStaff` (mutations stay on the `requireManager`
      alias until Deploy 3); `getAccountFeatures` bypasses on `platformRole==='super_admin'`; client
      `authStore` exposes `isSuperAdmin`/`isPlatformStaff` (`isManager`/`canManageAll` kept as aliases).
- [x] **Deploy 3 — RENAME SURFACE (code committed).** Admin mutation routes + transfer use
      `requireSuperAdmin` (was the `requireManager` alias, which is kept as a deprecated alias with no
      remaining call sites); CLAUDE.md role/scoping/admin sections rewritten for the RBAC model. Client
      `isManager`/`canManageAll` aliases and the conservative super-admin-only `/admin` middleware gate are
      intentionally retained (viewer read-only UI is roadmap item 5).
- [ ] **CONTRACT (deferred).** Remove the Deploy-2 fallbacks and (eventually) `publishers.type` +
      `publishers.accountId` — only after a consistency sweep shows 0 unstamped events and the wa-bot no
      longer reads `type`.

### Verification gates (each phase)
- **Login unbroken:** a single-account publisher lands on `/publisher/dashboard` with their one account
  auto-active (no extra screen); today's admin lands on `/admin` as `super_admin`; both carry a correct
  `activeAccountId`/`platformRole`.
- **Cross-tenant isolation:** a session scoped to account A fails read+write on an account-B event; a
  `viewer`'s every mutation 403s; a super_admin's cross-tenant action is audited (`isManagerAction`).
- **Migration:** dry-run asserts memberships == publishers-with-account (+ghosts), super_admins == old
  `type:'manager'` count, every non-deleted event has `event.accountId`; re-run → 0.
- **Consistency sweep** (re-runnable, like `cleanup-orphan-stats.js`): events where `event.accountId` ≠
  owner's account; publishers whose `accountId` has no live membership; dangling memberships. Must be 0
  before dropping Deploy-2 fallbacks.

## Future action items (NOT in this refactor)
The structure above supports all of these. Ordered roughly by likely priority.

1. **Account selection at login** — when a user has >1 business membership, a post-OTP "choose account"
   screen; store the choice as `activeAccountId` (session/cookie).
2. **Account switcher in the user menu** — change active account without re-login; re-scopes the whole portal.
3. **Collaborator invites (business accounts)** — invite a publisher to an account with a role; accept flow
   creates a membership; uses the reserved `membership.status` (`invited` → `active`).
4. **Platform-staff management UI** (`/admin`) — add/remove Galiluz staff (memberships in the platform
   account) and assign `super_admin`/`viewer`. Today this is DB/script-only.
5. **Viewer read-only UI** — hide all mutation controls in the admin portal for `viewer` (server already
   403s; client should match).
6. **Owner-vs-admin enforcement** — define owner-only powers (billing, managing members/invites, deleting
   the account) vs admin (events only). Functionally equal for now.
7. **Full M:N stats correctness** — scope stats by `event.accountId` (not the publisher-set) so a
   multi-account publisher's stats attribute to the right account. Only matters once a publisher is in 2 accounts.
8. **More platform roles** (e.g. `moderator`/`editor`) — approvals + event management without settings/broadcasts.
9. **Contract phase** — remove `publishers.type` + `publishers.accountId` once the admin client filter no
   longer needs `accountId` and a wa-bot deploy reads `platformRole`/memberships instead of `type`.
10. **Membership lifecycle + audit clarity** — `suspended` status; generalize `isManagerAction` to
    `actorScope` (which account/role acted).
11. **Step-up auth for platform staff** — MFA / stronger verification for `super_admin`/`viewer`; their
    cross-tenant power warrants more than the OTP that gates publishers.
12. **Per-tenant custom roles** — let enterprise accounts define their own roles/permission sets; the
    policy module ([authz.ts](../server/utils/authz.ts)) is the seam for this.
13. **Deeper normalization (optional)** — rename `publishers` → `users`; split auth/session state out of the
    identity doc. Only if it earns its churn.

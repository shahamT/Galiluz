# Data Model

MongoDB, one database (name from `MONGODB_DB_NAME`; dev `valley_luz_app_dev`, prod `valley_luz_app` — see [PRODUCTION_OPS.md](./PRODUCTION_OPS.md)). One shared connection via [mongodb.ts](../server/utils/mongodb.ts). All collection names are configurable through `MONGODB_COLLECTION_*` env vars; the defaults below are what runs everywhere in practice. Exception: `feedback` is hardcoded in [feedback.post.ts](../server/api/feedback.post.ts).

Indexes and `$jsonSchema` validators are created idempotently at startup by [ensure-indexes.ts](../server/plugins/ensure-indexes.ts) (fire-and-forget, one retry after 10s).

For the routes that read/write these collections, see [API.md](./API.md).

## Invariants — read before touching event data

- **Never `deleteOne` an event document.** Deletion is always soft: `$set: { deletedAt: new Date(), isActive: false }`. The only hard delete in the codebase is the *publisher* doc in [reject.post.ts](../server/api/publishers/reject.post.ts) (and only when `createdOnBehalf` is false) — event docs are never hard-deleted.
- **Every event read must exclude soft-deleted docs.** Either spread `NOT_DELETED` (`{ deletedAt: { $exists: false } }` from [eventsQuery.ts](../server/utils/eventsQuery.ts)) into the query, or — for `findOne` by `_id` — guard `if (!doc || doc.deletedAt) → 404` after the fetch. Both patterns are in use; pick one, never neither.
- **`occurrences[].startTime` is canonically an ISO 8601 UTC string.** Enforced on every write path by `validatePublisherFormattedEvent` in [eventValidation.ts](../server/utils/eventValidation.ts) (and a one-time migration completed 2026-06-12). Never write `Date` objects or `HH:MM` strings into it; string comparison against `toISOString()` values is how the feed query works.
- **Soft-deleting an event must stamp its stats.** Call `softDeleteEventStatsData(eventId, deletedAt)` ([eventStats.service.ts](../server/utils/eventStats.service.ts)) with the *same* `deletedAt` as the event doc. The cascade is not atomic — [scripts/cleanup-orphan-stats.js](../scripts/cleanup-orphan-stats.js) is the consistency sweep that re-stamps anything missed.
- **`eventLogs` is never stamped, never deleted.** Durable audit trail by design; deletions are themselves logged there.

## Collections overview

| Collection | Default name | Purpose | Retention | Growth profile |
|---|---|---|---|---|
| events | `events` | Core event documents (drafts + published; soft-deleted kept) | Forever | One doc per submitted event |
| publishers | `publishers` | Publisher accounts + OTP/session auth state | Forever | Small (one doc per publisher) |
| accounts | `accounts` | Tenant grouping publishers — `kind: 'business'` (owns events) or the single `'platform'` (Galiluz management) | Forever (soft-deleted kept) | Small (one doc per account; 1:1 with publishers today) |
| memberships | `memberships` | Publisher↔account↔role join (source of truth for roles); M:N-ready | Forever | One doc per (publisher, account) pair |
| eventStats | `eventStats` | Event-level engagement counters | Forever (stamped `deletedAt` on delete) | One doc per event with interactions |
| eventOccurrenceStats | `eventOccurrenceStats` | Per-(event, date) view/calendar counters | Forever (stamped) | One doc per event-occurrence-date with interactions |
| eventInteractions | `eventInteractions` | Raw interaction log (source for unique counting) | **TTL 90 days** | One doc per interaction — high volume |
| eventLogs | `eventLogs` | Durable audit trail of event lifecycle actions | **Forever, by design** | One doc per lifecycle action |
| authLogs | `authLogs` | Auth audit (OTP sends/failures, logins, blocks) | **TTL 30 days** | One doc per auth event |
| raw_messages | `raw_messages` | Raw WhatsApp webhook payloads (written by `apps/wa-listener`) | **TTL 7 days** | One doc per inbound WA message |
| feedback | `feedback` (hardcoded) | User feedback submissions | Forever | Low volume |
| appSettings | `appSettings` | Global app settings, one doc per domain keyed by `key` (e.g. `crawler`) | Forever | Tiny |
| crawlerMessages | `crawlerMessages` | Crawler dedup: `{publisherId, groupChatId, textHash, createdAt}` | **TTL 21 days** | One per crawled message |
| magicLinks | `magicLinks` | One-time login tokens: `{tokenHash, publisherId, target, expiresAt, usedAt}` | **TTL (expiresAt)** | One per issued link |
| broadcasts | `broadcasts` | Admin WhatsApp broadcast job + record: `{createdBy, createdByName, recipientIds[], recipientCount, messageTemplate, hasImage, imageUrl, status:'sending'\|'done'\|'failed', sentCount, failedIds[], createdAt, updatedAt, completedAt}` — gateway reports per-message progress (`sentCount`/`failedIds`) back; the admin page polls it live | Forever | One per broadcast (low volume) |

`publishers` also carries an optional **`preferences`** object (per-publisher toggles; registry [consts/preferences.const.js](../consts/preferences.const.js), resolver [publisherPreferences.ts](../server/utils/publisherPreferences.ts)) — distinct from account-level `features`. First key: `autoGenerateDraftsByCrawler` (registry default false, but **set true on first approval** so new publishers are crawler-tracked by default; only approved non-ghost publishers are eligible). Resolved onto `/api/auth/me` → `authStore.hasPreference(key)`.

**Collection-name gotcha:** when `MONGODB_COLLECTION_EVENTS_WA_BOT` is set, wa-bot and portal write paths use it (`config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents`), but the public feed, `meta`, and `first-occurrence` read only `mongodbCollectionEvents`. That split exists for testing wa-bot writes against an alternate collection — leave the var unset unless you mean it.

## events

The central document. `event` (formatted, what the site renders) and `rawEvent` (original input, audit) live side by side; drafts have `event: null`.

```js
{
  _id: ObjectId,
  createdAt: Date,
  updatedAt: Date,                  // optional, set on edits/activation
  isActive: Boolean,                // false for drafts and deactivated events
  deletedAt: Date,                  // PRESENT = soft-deleted. Absent on live docs.

  event: {                          // formatted event — null while draft
    Title: String,                  // required; capital T (legacy naming)
    shortDescription: String,
    fullDescription: String,        // sanitized HTML — only p,br,strong,em,del,code,pre,blockquote,ul,ol,li survive sanitizeHtml
    publisherId: String,            // publishers._id.toString() — NOT an ObjectId
    originalCreatorPublisherId: String, // immutable creator (stamped at create; set on first transfer for legacy)
    accountId: String,              // TENANT KEY (RBAC) — owning account; stamped at create, moved on transfer
    publisherPhone: String,         // digits only, may be ''

    occurrences: [{                 // at least 1 (validated)
      date: 'YYYY-MM-DD',           // Israel calendar date of the occurrence
      hasTime: Boolean,             // false → startTime is Israel-midnight UTC, endTime null
      startTime: String,            // ISO 8601 UTC — CANONICAL, validated on write
      endTime: String | null,       // ISO 8601, must be > startTime, else normalized to null
    }],

    multiDayEvent: Boolean,         // default true; false = each occurrence shown/counted separately
    mainCategory: String,           // must be included in categories (validated)
    categories: [String],           // at least 1; invalid/empty falls back to FALLBACK_CATEGORY_ID

    location: {                     // must have city OR locationName (validated)
      city: String,
      cityType: 'listed' | 'custom',// optional
      locationName: String,
      addressLine1: String,
      addressLine2: String,         // optional; settable via wa-bot patch only
      locationDetails: String,      // free-text notes (portal sends it as locationNotes)
      region: 'center' | 'golan' | 'upper',  // optional, for listed cities; feed region filter
      wazeNavLink: String | null,   // http(s) only (safeUrl)
      gmapsNavLink: String | null,
    },

    price: Number | null,           // ILS; null = free

    urls: [{ Title: String, Url: String, type: 'link' | 'phone' }],

    media: [{
      cloudinaryURL: String,
      cloudinaryData: {             // Cloudinary upload result
        public_id: String,          // used for destroy() on delete
        resource_type: 'image' | 'video',
        // format, width, height, bytes, ...
      },
      isMain: Boolean,              // primary image for SEO/social card
    }],
  } | null,

  rawEvent: {                       // shape depends on source:
    // wa-bot flow: raw* snapshot fields + publisher identity
    publisher: { waId, phone?, name?, publisherId? },
    publisherId: String,            // resolved from waId lookup at insert
    rawTitle, rawFullDescription, rawMainCategory, rawCategories,
    rawCity, rawRegion, rawLocationName, rawAddressLine1, rawAddressLine2,
    rawLocationDetails, rawOccurrences, rawPrice, rawUrls, rawMedia, // ...
    // portal flow: minimal
    // { publisherId: String, source: 'publisher_portal' }
  },
}
```

Field semantics worth knowing:

- `isActive` and `deletedAt` are independent axes: a draft is `isActive: false` without `deletedAt`; a deactivated event is hidden from the feed but editable in the portal; a deleted event has both `deletedAt` set and `isActive: false`.
- `event.publisherId` is the ownership key for the publisher portal; `rawEvent.publisher.waId` is the ownership key for wa-bot flows. The reject cascade matches on either.
- Normalization (`normalizePublisherFormattedEvent`) runs before validation on every write: category fallback, `date`↔`startTime` Israel-day alignment, `hasTime:false` → Israel-midnight UTC `startTime`, invalid/past-start `endTime` → null.

## publishers

Account, approval state, and all auth state in one doc.

```js
{
  _id: ObjectId,
  waId: String,                     // UNIQUE. Normalized Israeli phone: 972XXXXXXXXX
  accountId: String,                // accounts._id.toString() — the DEFAULT-ACTIVE-account pointer (auto-created at approval)
  status: 'pending' | 'approved' | 'ghost',   // only 'approved' can log in / receive OTP
  // type: 'publisher' | 'manager'  — LEGACY. Roles now live in `memberships` (see below). No longer
  //   written or read for authorization; only old docs still carry it. Manage staff via
  //   scripts/set-platform-role.js (a super_admin membership), NOT by setting this field.

  createdAt: Date,
  createdOnBehalf: Boolean,         // true for ghost records created via API; reject never hard-deletes these
  approvedAt: Date, updatedAt: Date,

  fullName: String,
  email: String,                    // web registration (validated); shown to the approver
  accountName: String,              // the account name → becomes accounts.title on approval
                                    //   (replaces the old publisher-level `publishingAs`)
  eventTypesDescription: String,    // onboarding free text
  approvedTerms: Boolean, approvedTermsAt: Date,
  phoneVerified: Boolean,           // web registration: true after the OTP step
  registrationSource: String,       // 'web' for website registrations (absent = bot)
  phone: String,                    // ghost records only (set equal to waId)

  // OTP state — written by send-otp, cleared on successful verify
  otp: String,                      // HMAC-SHA256(plaintext OTP, OTP_SECRET), hex
  otpExpiresAt: Date,               // +10 minutes
  otpSentCount: Number,             // max 5 per rolling hour
  otpSentWindowStart: Date,
  otpAttempts: Number,              // failed verifies; survives OTP re-sends BY DESIGN, reset only on login
  otpBlockedUntil: Date,            // set after 5 failed attempts (+30 min)

  // Session — written by verify-otp, cleared by logout
  authKey: String,                  // HMAC-SHA256(session token, OTP_SECRET)
  authKeyExpiresAt: Date,           // +1 hour
}
```

`status: 'ghost'` means a placeholder record (publisher posts via a manager / was rejected after `createdOnBehalf` creation). [check.get.ts](../server/api/publishers/check.get.ts) reports ghosts as `not_found` to the wa-bot.

## accounts

Groups publishers under an account (the **tenant**). Two kinds: **`business`** (the default — owns events; one account → many publishers, today 1:1) and exactly one **`platform`** account ("Galiluz Management", owns no events) whose members are Galiluz staff. Roles are NOT stored here — they live in [`memberships`](#memberships).

```js
{
  _id: ObjectId,
  title: String,        // display name; seeded from publisher.accountName at approval (the account-name field)
  kind: String,         // 'business' (default, owns events) | 'platform' (the single Galiluz-management org)
  isActive: Boolean,    // default true; false = disabled
  createdAt: Date,
  deletedAt: Date,      // PRESENT only when soft-deleted (absent on live accounts, like events)
  features: {           // OPTIONAL account-level feature flags (entitlements); absent = all default OFF
    globalStats: Boolean,    // dashboard KPI totals + account-wide stats list + top-event numbers
    perEventStats: Boolean,  // per-event statistics tab on the event detail page
  },
}
```

- **Created** automatically when a publisher is approved ([approve.post.ts](../server/api/publishers/approve.post.ts) → `ensureAccountForPublisher` in [accountScope.ts](../server/utils/accountScope.ts)), which also writes the publisher's **`owner` membership**; existing publishers are backfilled by [scripts/backfill-accounts.js](../scripts/backfill-accounts.js) (accounts) + [scripts/backfill-memberships.js](../scripts/backfill-memberships.js) (memberships + `event.accountId`).
- **`features`** is the entitlement map (registry: [consts/features.const.js](../consts/features.const.js); resolver: [accountFeatures.ts](../server/utils/accountFeatures.ts)). Default **OFF / opt-in** — an absent flag resolves to disabled. **Enforcement is server-side** (gated endpoints omit the data); the client receives the resolved map only to gate UI. **Managers/platform staff bypass** (always all-enabled) and the admin portal never checks `features`. Set them in the DB via [scripts/set-account-features.js](../scripts/set-account-features.js) (no admin UI yet).
- **Released** (soft-deleted) when its last publisher is hard-deleted on reject ([reject.post.ts](../server/api/publishers/reject.post.ts)).
- **Scoping (transitioning, see RBAC rollout):** stats/dashboard scope by the account's publisher set — `eventStats.publisherId ∈ getAccountPublisherIds(session)` (resolves `account → its publisherIds`, falling back to the caller's own id) — because stats rows are keyed by `publisherId`. **Event** reads/ownership move to the tenant key `event.accountId === session.activeAccountId` in Deploy 2. Until then `event.accountId` is dual-written but reads still use `getAccountPublisherIds`.

## memberships

The **source of truth for roles**: one row per `(publisher, account)` pair, M:N-ready (a publisher can belong to several accounts with a different role in each). Roles are scoped by the account's `kind`. Introduced by the multi-tenant RBAC refactor (see [plans/multi-account-roadmap.md](../plans/multi-account-roadmap.md)).

```js
{
  _id: ObjectId,
  publisherId: String,  // publishers._id.toString()
  accountId: String,    // accounts._id.toString()
  role: String,         // business account: 'owner' | 'admin'   ·   platform account: 'super_admin' | 'viewer'
  status: String,       // 'active' (today); 'invited'/'suspended' reserved for future invite/lifecycle flows
  createdAt: Date,
}
```

- **Disjoint role names by plane** (business `owner`/`admin` vs platform `super_admin`/`viewer`) let the session classify platform vs business membership without joining `account.kind`.
- **Roles are read FRESH per request** in [requirePublisherAuth.ts](../server/utils/requirePublisherAuth.ts) (one indexed `{publisherId}` find) and resolved through the central policy module [authz.ts](../server/utils/authz.ts) (capability→role map). A role is **never denormalized/cached** onto the publisher — a stale role cache is the classic multi-tenant privilege-escalation bug. Only the account *pointer* (`publishers.accountId`) is cached, and it's validated against memberships at session build.
- **Written idempotently** via `ensureMembership(publisherId, accountId, role)` (upsert on the unique pair; never downgrades an existing role). New registrant → `owner` of their auto-created business account. Galiluz staff hold `super_admin`/`viewer` rows in the single platform account (set via script today; UI is roadmap).

## eventStats

One doc per event, event-level cumulative counters. Upserted by [interact.post.ts](../server/api/events/[id]/interact.post.ts).

```js
{
  eventId: String,                  // events._id.toString() — UNIQUE
  publisherId: String,              // snapshot of event.publisherId
  shares: Number, navClicks: Number, linkClicks: Number, contactClicks: Number,
  views: Number,                    // fallback only: views reported without an occurrenceDate
  lastInteractionAt: Date,
  deletedAt: Date,                  // stamped on event soft-delete
  orphaned: Boolean,                // set only by scripts/cleanup-orphan-stats.js when the event doc no longer exists
}
```

## eventOccurrenceStats

One doc per (event, occurrence date). The primary views store.

```js
{
  eventId: String,
  occurrenceDate: 'YYYY-MM-DD',     // (eventId, occurrenceDate) UNIQUE
  publisherId: String,
  views: Number,
  uniqueViews: Number,              // first view per visitorId per occurrence date
  calendarAdds: Number,
  lastInteractionAt: Date,
  deletedAt: Date,                  // stamped on event soft-delete
}
```

## eventInteractions

Raw append-only interaction log; the unique-view computation counts these. TTL: 90 days — never rely on it for history beyond that.

```js
{
  timestamp: Date,                  // TTL index field
  eventId: String, publisherId: String,
  visitorId: String,                // anonymized client id, truncated to 64 chars
  action: 'view' | 'share' | 'nav' | 'calendar' | 'link' | 'contact',
  occurrenceDate: 'YYYY-MM-DD',     // present for view/calendar
  navType: String,                  // ≤20 chars (e.g. 'waze')
  calendarType: String,             // ≤20 chars
  linkTitle: String,                // ≤100 chars — feeds the link breakdown in portal event detail
  linkType: String,                 // ≤10 chars ('link' | 'phone')
  deletedAt: Date,                  // stamped on event soft-delete
}
```

## eventLogs

Durable audit trail, written via [eventLogs.service.ts](../server/utils/eventLogs.service.ts) (all writers are non-throwing — a failed log never breaks the flow). **Kept forever; the soft-delete cascade intentionally does not touch it.**

```js
{
  createdAt: Date,
  eventId: String,
  action: 'draft_created' | 'draft_processed' | 'event_created'
        | 'event_activated' | 'event_deactivated' | 'event_edited' | 'event_deleted',
  publisherId: String, waId: String,           // when known
  correlationId: String,                       // greppable against server logs (X-Correlation-Id)
  isManagerAction: Boolean,                    // true when a manager acted on another publisher's event

  title: String, rawTitle: String,             // creation/activation/deletion actions

  // event_edited only:
  changedFields: [String],                     // e.g. ['Title', 'occurrences', 'price']
  previous: { raw: {}, final: {} },            // pre-edit snapshots
  new:      { raw: {}, final: {} },
  editSource: String,                          // 'publisher_portal' | wa-bot-supplied (e.g. 'free_language')

  // event_deleted only:
  deletionType: 'kill' | 'user_deleted',       // kill = wa-bot flow abandoned; user_deleted = explicit
}
```

## authLogs

Written by [authLog.ts](../server/utils/authLog.ts) (non-throwing). TTL: 30 days.

```js
{
  timestamp: Date,                  // TTL index field
  action: 'otp_sent' | 'otp_failed' | 'login' | 'logout' | 'blocked' | 'publisher_rejected',
          // type also declares 'auth_failed' | 'otp_request_unregistered' (currently unwritten)
  waId: String | null,
  ip: String, userAgent: String,
  // extras per action:
  secondsLeft: Number,              // blocked
  attemptsLeft: Number, blocked: Boolean,  // otp_failed
  cascadedEvents: Number,           // publisher_rejected — count of soft-deleted events
}
```

## raw_messages

Inbound WhatsApp webhook payloads, written by `apps/wa-listener` (out of scope here), read by the `whatsapp-messages` / `whatsapp-media` API-secret routes. Docs carry `createdAt` (TTL field, 7 days), `raw` (the webhook payload), and `cloudinaryUrl` for media messages.

## feedback

```js
{ createdAt: Date, topic: 'bug'|'feature'|'content'|'general'|'other', content: String /* 10–2000 chars */ }
```

No indexes, no TTL, hardcoded collection name.

## Indexes, TTLs, validators

All created at startup by [ensure-indexes.ts](../server/plugins/ensure-indexes.ts):

| Collection | Index | Notes |
|---|---|---|
| events | `{ isActive: 1, deletedAt: 1, 'event.occurrences.startTime': 1 }` | Public feed query |
| events | `{ 'event.publisherId': 1 }` | Portal queries |
| events | `{ 'event.accountId': 1, deletedAt: 1 }` | Tenant-scoped event reads (RBAC) |
| events | `{ 'rawEvent.publisher.waId': 1 }` | reject cascade (match a publisher's events) |
| eventInteractions | `{ eventId: 1, action: 1, timestamp: -1 }` | Recent interactions |
| eventInteractions | `{ eventId: 1, action: 1, visitorId: 1 }` | Unique-view counting |
| eventInteractions | `{ publisherId: 1, timestamp: -1 }` | Publisher activity |
| eventInteractions | `{ timestamp: 1 }` **TTL 90d** | Retention |
| eventStats | `{ eventId: 1 }` **unique** | One stats doc per event |
| eventStats | `{ publisherId: 1 }` | Dashboard |
| eventOccurrenceStats | `{ eventId: 1, occurrenceDate: 1 }` **unique** | Upsert target for view/calendar |
| eventOccurrenceStats | `{ publisherId: 1, occurrenceDate: 1 }` | Dashboard active/month filters |
| eventLogs | `{ publisherId: 1, createdAt: -1 }` | Recent activity feed |
| publishers | `{ waId: 1 }` **unique** | Phone lookup |
| memberships | `{ publisherId: 1, accountId: 1 }` **unique** | One role per (publisher, account) |
| memberships | `{ accountId: 1 }` | Members of an account (e.g. list platform super_admins) |
| memberships | `{ publisherId: 1 }` | A publisher's accounts (session build) |
| authLogs | `{ timestamp: 1 }` **TTL 30d** | Retention |
| raw_messages | `{ createdAt: 1 }` **TTL 7d** | Retention |

Additionally, [requirePublisherAuth.ts](../server/utils/requirePublisherAuth.ts) ad-hoc-creates `{ authKey: 1, authKeyExpiresAt: 1 }` on publishers (idempotent, per request, errors swallowed).

**Validators** (`$jsonSchema`, `validationLevel: 'moderate'`, `validationAction: 'error'` — new inserts and updates to already-valid docs must conform; legacy docs stay writable):

- `events`: `isActive` bool, `deletedAt` date, `event` object-or-null with `Title`/`publisherId`/`accountId` strings and `occurrences` items `{ date: /^\d{4}-\d{2}-\d{2}/, startTime: string, endTime: string|null, hasTime: bool }`.
- `publishers`: `waId` required string; `status`/`type`/`fullName` strings.
- `accounts`: `title` required string; `kind` string.
- `memberships`: `publisherId`/`accountId`/`role` required strings; `status` string, `createdAt` date.

Deliberately permissive — business validation lives in [eventValidation.ts](../server/utils/eventValidation.ts); the validators are a backstop against structurally broken documents.

## Lifecycles

Events are created by the **publisher portal** and the **WhatsApp crawler** (gateway → ingest).
The old in-bot draft→process→activate publisher flow was retired (the bot only directs publishers
to the web portal).

### Portal create

`POST /api/publisher/events` builds the formatted `event` in one shot (sanitize → `convertOccurrenceTimes` → normalize → validate) and inserts `{ isActive: false, event, rawEvent: { publisherId, source: 'publisher_portal' } }`, logging `event_created`. Activation is a separate `PATCH /api/publisher/event/[id]/status` call.

### Edit paths

- **Portal**: `PATCH /api/publisher/event/[id]` ([\[id\].patch.ts](../server/api/publisher/event/[id].patch.ts)) — ownership check (tenant key), sanitize, merge partial body into existing `event`, normalize, validate, `$set { event: merged }`. Logs `event_edited` with `changedFields` + previous/new snapshots, `editSource: 'publisher_portal'`, `isManagerAction` when a super-admin edits another account's event.

### Soft delete — exact sequence

Both delete routes ([publisher portal](../server/api/publisher/event/[id].delete.ts) and the [approver delete](../server/api/events/[id]/delete.post.ts) the bot calls) run the identical sequence:

1. `findOne` the event; 404 if missing. **If `doc.deletedAt` already set → return `{ success: true }`** (idempotent re-delete, no double cascade).
2. `logEventDeletion(...)` to eventLogs (`deletionType: 'kill' | 'user_deleted'`, non-throwing) — the audit record is written first and is **intentionally kept forever**.
3. Stamp the event doc: `$set { deletedAt, isActive: false }`. The event doc goes first because the interact endpoint's guard reads it — stamping it immediately stops new stats data from stale open tabs.
4. `softDeleteEventStatsData(id, deletedAt)` — `updateMany` the same `deletedAt` onto eventStats, eventOccurrenceStats, eventInteractions; on failure, retried once inside the service.
5. `deleteEventCloudinaryMedia(doc)` ([eventMedia.service.ts](../server/utils/eventMedia.service.ts)) — destroy every `media[].cloudinaryData.public_id` on Cloudinary. Best-effort: failures are logged and never block the delete.

The sequence is **not atomic**. If step 4 fails twice, run `node scripts/cleanup-orphan-stats.js` (pass 2 re-stamps stats of soft-deleted events; pass 1 stamps `orphaned: true` on stats whose event doc no longer exists at all).

### Publisher rejection cascade

`POST /api/publishers/reject` ([reject.post.ts](../server/api/publishers/reject.post.ts)):

1. Find all non-deleted events matching `event.publisherId === publisherId` **or** `rawEvent.publisher.waId === waId` (catches drafts that never got a formatted event).
2. For each: stamp the event doc, then `softDeleteEventStatsData`. Note: this path does **not** destroy Cloudinary media (unlike single-event delete).
3. The publisher doc: `createdOnBehalf: true` → `status: 'ghost'` (kept for audit); otherwise hard-deleted.
4. authLogs gets `publisher_rejected` with `cascadedEvents` count.

### Interactions: counting rules

`POST /api/events/[id]/interact` first loads the event doc and **refuses (`{ success: false }`) if missing or soft-deleted**, then:

1. Inserts the raw doc into eventInteractions (always).
2. `view`/`calendar` **with** `occurrenceDate` → upsert into eventOccurrenceStats: `views`/`calendarAdds` `$inc`; `uniqueViews` increments only when this is the visitor's first `view` for that (event, date) — determined by counting eventInteractions for that `visitorId` (so a visitor becomes "new" again after the 90-day TTL purges their history).
3. Everything else (`share`/`nav`/`link`/`contact`, or a `view` without `occurrenceDate`) → upsert event-level counters into eventStats.

`publisherId` is snapshotted onto both stats docs from the event document on every interaction.

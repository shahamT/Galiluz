# Event approval and 30‑minute timeout — plan

## Goal

1. **When the (event) approver approves the event** → set `isActive = true` so the event goes live.
2. **If 30 minutes pass without any response** (during the approval phase) → together with killing the conversation, **delete the event** from the DB.
3. This logic must stay in place **at all steps until the event is “saved”** (i.e. until it is either approved and active, or rejected/timed out and removed).

Interpretation used in this plan:

- Events are created with `isActive: false` (current behavior).
- An **approver** (same WhatsApp number as publisher approver, or a dedicated one) is notified when a new event is saved and can **approve** (→ `isActive = true`) or **reject** (→ delete or leave inactive).
- The 30‑minute rule applies to the **approval phase**: from “event created, waiting for approver” until we either approve or hit the timeout; on timeout we delete the event and clear the approver’s state.

If instead “publisher approved” means the **publisher** (creator) confirms in the confirm step and you want **no** separate event-approval step, then the only change is: on “אישור ושמירה” set `isActive: true` when creating the event, and the 30‑min + delete logic applies only to the **event-add form** (before save): on timeout we only kill the conversation (no event exists yet). This doc assumes the “approver approves event” flow; the other variant is noted at the end.

---

## Current state

- **Event create** (`server/api/events/create.post.ts`): inserts document with `isActive: false`. Returns `{ id, success: true }`.
- **Wa-bot** after “אישור ושמירה”: calls create API, clears state, sends success + welcome. Does **not** notify an approver or store event id for approval.
- **Publisher approver flow** (`handleApproverFlow`): approves/rejects **publishers** (people), not events. Uses buttons `approve_<waId>`, `reject_<waId>`, etc.
- **Event-add timeout**: 30 min inactivity → `killEventAddFlow` (clear state, delete uploaded media, send welcome). No event in DB yet, so no event to delete.
- **Events query** (`server/utils/eventsQuery.ts`): only returns docs with `isActive: true`.

---

## 1. Server: event activate and delete

| Item | Action |
|------|--------|
| **Activate** | New endpoint, e.g. `PATCH /api/events/:id/activate` or `POST /api/events/:id/activate`. Protected by same API secret as create. Body optional. Sets `isActive: true` (and e.g. `activatedAt: new Date()` if desired). Returns 200 + minimal payload or 404 if event not found. |
| **Delete** | New endpoint, e.g. `DELETE /api/events/:id` or `POST /api/events/:id/delete`. Protected by API secret. Deletes the event document (and optionally any linked media references). Returns 200 or 404. Used on approver reject and on 30‑min timeout. |

Both operate on the same collection used by create (e.g. `events` or `eventsWaBot`).

---

## 2. Wa-bot: after event is saved — notify approver

- After **successful** `createEvent()` in `submitEvent`:
  - We have `result.id` (event id).
  - Call a small **“notify event approver”** flow: send to `config.publishersApproverWaNumber` (or a dedicated `eventApproverWaNumber` if you add it) a message with:
    - Short event summary (e.g. title, date, publisher waId/name if available).
    - Two buttons: **Approve event** and **Reject event** (e.g. `approve_event_<eventId>`, `reject_event_<eventId>` to avoid collision with `approve_<waId>`).
  - Do **not** clear publisher state before sending success; we only need to ensure approver gets the message. Publisher state is already cleared after create.

- Approver state (conversation state for the approver’s waId):
  - New step, e.g. `EVENT_APPROVAL_WAITING` or reuse a generic “approver has pending event”.
  - Store: `pendingEventId`, `pendingEventLastActivityAt: Date.now()`, and optionally `pendingEventPublisherWaId` for “who created this” in messages.

---

## 3. Wa-bot: approver flow — handle event approve/reject

- **Routing**: When the message is from the approver number, we must distinguish:
  - **Publisher approval** (existing): `approve_<waId>`, `reject_<waId>`, `reject_no_reason_<waId>`.
  - **Event approval** (new): `approve_event_<eventId>`, `reject_event_<eventId>`.

- **Event approve** (`approve_event_<eventId>`):
  - Call activate API for `eventId`. On success: set `isActive: true`.
  - Clear approver state for this pending event (`pendingEventId`, etc.).
  - Send confirmation to approver (e.g. “האירוע אושר ופורסם”).
  - Optionally notify publisher (e.g. “האירוע שלך אושר ופורסם”) using `pendingEventPublisherWaId` if stored.

- **Event reject** (`reject_event_<eventId>`):
  - Call delete API for `eventId`.
  - Clear approver state.
  - Send confirmation to approver (e.g. “האירוע נדחה והוסר”).
  - Optionally notify publisher.

- **30‑minute timeout (at all steps)**:
  - At the **start** of `handleApproverFlow` (or the single place that routes approver messages), before handling any button:
    - If `state.pendingEventId` is set and `state.pendingEventLastActivityAt` exists and `Date.now() - state.pendingEventLastActivityAt > 30 * 60 * 1000`:
      - Call delete API for `state.pendingEventId`.
      - Clear approver state (e.g. `conversationState.clear(from)` or only clear event-related keys).
      - Send a short message to approver, e.g. “פג תוקף. האירוע הוסר.”
  - Then continue with normal routing (event approve/reject or publisher approve/reject). So the “no response for 30 min” is enforced on **next** message from approver (we don’t have a background job). If you need “exactly 30 min then auto-delete” without the user writing again, you’d need a scheduled job or a small cron; this plan only describes “on next message after 30 min, delete and clear.”

- **Consistency**: “At all steps until the event is saved” here means: whenever the approver is in a state where we’re waiting for a decision on a pending event (any sub-step), we run the same timeout check first. So one central check at the top of the approver flow is enough.

---

## 4. Wa-bot: event-add flow — timeout (no event to delete)

- **Before save** (all steps from title through confirm): we already have a 30‑min timeout that calls `killEventAddFlow`. No event exists in the DB yet, so we only clear state and delete uploaded media. **No change** needed for “delete event” here.

- **After save**: the event is created and we hand off to the approver. The 30‑min + delete logic lives in the **approver** flow as above.

---

## 5. Optional: store event id in state before clear (if needed)

- Today we clear publisher state right after create. If we need to “notify publisher when event is approved/rejected,” we could:
  - Store `lastCreatedEventId` and `lastCreatedEventAt` in publisher state **before** clear, and clear after sending success; or
  - Store event id and publisher waId when notifying the approver (`pendingEventPublisherWaId`), and use that to notify the publisher when approver approves/rejects. Prefer storing in approver state so we don’t keep publisher state around.

---

## 6. Consts and services

- **Consts**: Add copy for event-approval messages (approver request body template, button ids/labels, confirm approved/rejected, timeout message). Reuse or mirror publisher-approval style.
- **Services**: Add `activateEvent(eventId)` and `deleteEvent(eventId)` that call the new server endpoints (same base URL and API key as create).

---

## 7. File list (summary)

| Area   | File / endpoint | Action |
|--------|------------------|--------|
| Server | `server/api/events/[id]/activate` (PATCH or POST) | New: set `isActive: true` |
| Server | `server/api/events/[id]/delete` (DELETE or POST)   | New: delete document |
| Wa-bot | `apps/wa-bot/src/services/eventsCreate.service.js` (or new `eventsApprove.service.js`) | Add `activateEvent(id)`, `deleteEvent(id)` |
| Wa-bot | `apps/wa-bot/src/consts/index.js` | Event-approval messages and button ids |
| Wa-bot | `apps/wa-bot/src/routes/webhook.js` | After create success: notify approver with event summary + approve/reject buttons; store `pendingEventId` + `pendingEventLastActivityAt` in approver state |
| Wa-bot | `apps/wa-bot/src/routes/webhook.js` (handleApproverFlow) | At start: if pending event and > 30 min, delete event and clear state; handle `approve_event_*` and `reject_event_*` (call activate/delete APIs) |
| Wa-bot | `apps/wa-bot/src/services/conversationState.service.js` | Document new keys: `pendingEventId`, `pendingEventLastActivityAt`, and step for event approval |

---

## 8. Alternative: no event approver (publisher “approves” by confirming)

If the intended flow is:

- “Publisher approved the event” = user clicked “אישור ושמירה” (no separate approver),
- Then on create we set **`isActive: true`** in `server/api/events/create.post.ts` so the event is live immediately.
- 30 min timeout only applies to the **form**: after 30 min we kill the conversation; no event exists yet, so nothing to delete.

In that case you only need:

- Ensure event is created with `isActive: true` when the user confirms (or keep `isActive: false` if you want a later “publish” step in the product).
- No new endpoints, no approver event flow, no delete on timeout (only `killEventAddFlow` as today).

---

## 9. Edge cases

- **Activate/delete with wrong or old event id**: Server returns 404; bot clears state and sends a short “שגיאה” message.
- **Approver gets multiple events in a row**: Plan uses one pending event per approver (one `pendingEventId`). If you need a queue of events, state shape and button ids would need to support multiple pending events (e.g. list or queue).
- **Duplicate approve/reject**: Idempotent: activate already-active event is safe; delete already-deleted returns 404, clear state and continue.

---

This plan keeps “approve → isActive = true” and “30 min without response → kill conversation and delete event” at all steps of the approval phase until the event is either saved as active or removed.

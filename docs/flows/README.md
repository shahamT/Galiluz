# Flows

End-to-end documentation of **cross-cutting flows** — features whose logic spans
multiple files, services, or hops (web ↔ wa-gateway ↔ Green API ↔ OpenAI ↔
Cloudinary ↔ DB). The reference docs one level up describe the system by *layer*
([DATA_MODEL](../DATA_MODEL.md), [API](../API.md), [FRONTEND](../FRONTEND.md),
[ARCHITECTURE](../ARCHITECTURE.md)); these describe it by *journey* — one document
that follows a single feature from trigger to outcome, so a future agent can pick
up the whole thing without reverse-engineering it from a dozen files.

## When to write one

Write a flow doc when a feature:
- spans more than one service or more than ~4 files, **or**
- has a non-obvious sequence, security boundary, or failure mode, **or**
- took real effort to debug end-to-end (capture what bit us so it doesn't bite again).

**Policy:** every new cross-cutting flow we build gets a doc here as part of the
work — not after. We are also back-filling existing flows over time.

## How to write one

Copy the section skeleton below. Keep it accurate over pretty: cite real
`file.ext:line` paths (relative to repo root, e.g. `../../server/...`), real env
var names, real collection names, real skip/return strings. When the code changes,
update the doc in the same change. A wrong reference doc is worse than none.

```
# <Flow name>

> Status · Added <YYYY-MM-DD> · Key commits <short shas> · Owner-area <web|gateway|…>

1. Purpose & user story        — what it does, who triggers it, what they get.
2. End-to-end sequence         — ASCII hop diagram + numbered steps.
3. Components                  — table: file → role, grouped by layer.
4. Data model                  — collections/fields this flow reads or writes.
5. The pipeline / core logic   — step-by-step, with every skip/branch reason.
6. Authentication & security   — the guard at each hop.
7. Configuration               — env vars + external-service setup.
8. Resilience                  — retries, idempotency, failure handling.
9. Enablement runbook          — how to turn it on in prod.
10. Testing                    — local vs prod, fixtures, caveats.
11. Troubleshooting            — known failure modes (symptom → cause → fix).
12. Gotchas & future work      — traps, and what's stubbed / not yet wired.
```

Not every flow needs all twelve — drop sections that don't apply — but keep the
order so the docs are scannable.

## Index

| Flow | Doc | Services |
|---|---|---|
| WhatsApp Crawler → auto-draft events | [whatsapp-crawler-auto-draft.md](whatsapp-crawler-auto-draft.md) | Green API · wa-gateway · web · OpenAI · Cloudinary |
| Admin broadcast → WhatsApp message to publishers | [admin-broadcast-messages.md](admin-broadcast-messages.md) | web · wa-gateway · Green API · Cloudinary |
| Approver management (multi-approver, first-wins) | [approver-management.md](approver-management.md) | web · wa-bot · Cloud API |

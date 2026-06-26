# Unit-test deploy gate — research notes & open questions

**Status: PARKED (2026-06-25).** Captured so we can resume later. The region-filter fix
that prompted this discussion already shipped separately (commit `02edbd2` / merge `b336d6a`);
this doc is the follow-up hardening: making the unit tests a *hard gate* on production deploys.

## Why this came up
The wa-bot "no events" bug was a **web-app logic bug** (server-side region filter only matched
the stored `event.location.region`, which listed cities don't store) that deployed to production
without any automated test gate. Tests existed and passed locally, but **nothing blocked the
deploy on them**. Goal the user stated: *"I don't want anything to deploy until the unit tests
come back 100% approved."*

## Safety question — ANSWERED ✅
> Does the gate's test run touch the real database, send WhatsApp messages, or call OpenAI?

**No.** `npm test` = `vitest run` using [vitest.config.ts](../vitest.config.ts):
`include: ['tests/**/*.test.ts']`, `exclude: [...defaults, 'tests/eval/**']`, **no** `setupFiles`/`globalSetup`.
All 14 default test files are pure logic assertions — audited for and found **zero** usage of
`MongoClient`/`getMongoConnection`/`mongodb`, `fetch`/`$fetch`/`axios`, OpenAI clients, WhatsApp/
Green-API senders, file writes, or real-credential `process.env` reads.

The **only** suite that calls OpenAI and writes a file is the separate **eval** suite
(`tests/eval/**`, run via `npm run eval:matcher` with `vitest.eval.config.ts`). It is **excluded**
from `npm test` and self-skips (`describe.skipIf(!apiKey)`) when no `OPENAI_API_KEY` is present.
→ It would **not** run in a deploy gate. Safe in both GitHub CI and a Render build.

## Current deploy reality (the gap)
- **CI** ([.github/workflows/ci.yml](../.github/workflows/ci.yml)): on push to `main`/`develop` + PRs →
  `npm ci` → **`npm test`** → `npm run build`. So tests *do* run on every push.
- **Render** ([render.yaml](../render.yaml)): 3 services deploy from `main`
  (`galiluz-web`, `galiluz-wa-bot`, `galiluz-wa-gateway`); auto-deploys on push. Build commands do
  **not** run `npm test`.
- **CI and Render are NOT linked.** Render deploys `main` regardless of CI status. A failing
  **build** blocks the deploy (Render runs `npm run build`); a failing **test** does **not**
  (Render never runs tests). That's the hole to close.

## Deploy topology detail
- `galiluz-web`: **no `rootDir`** → builds from repo root, where `tests/` + `vitest.config.ts` live.
  buildCommand today: `npm install && npm run build`.
- `galiluz-wa-bot`: `rootDir: apps/wa-bot`.
- `galiluz-wa-gateway`: `rootDir: apps/wa-gateway`.
- The root unit suite covers the **web app + shared utils**. It does **not** exercise the
  wa-bot / wa-gateway internals (separate code under `apps/*`).

## Key facts to remember
- `vitest` is a **devDependency** (so are `sass`, `sharp`); `nuxt` is a regular dependency.
- Render **installs devDependencies at build time** — proven because the SCSS build needs `sass`
  (a devDep) and web builds succeed. So `npm test` would find `vitest` in a `galiluz-web` build.

## Gate options (with tradeoffs)
**A. Render "Auto-Deploy: After CI Checks Pass" (dashboard, per service)**
- Blanket gate across all 3 services via the existing CI (which already runs `npm test` + build).
- No code change. **Not expressible in render.yaml** — toggled per service in the dashboard:
  *Settings → Build & Deploy → Auto-Deploy → "After CI Checks Pass."* (I cannot toggle this from here.)
- Pro: covers everything; single test run; no duplication. Con: needs dashboard action; can be
  turned off out-of-band; deploys wait for full CI (a few minutes).

**B. Add `npm test` to `galiluz-web` buildCommand in render.yaml**
- `buildCommand: npm install && npm test && npm run build` — failing test fails the build → the
  previous version stays live. In-code, ships with a commit. **Gates `galiluz-web` only.**
- Pro: reliable, codified, covers the service these tests actually cover (and the one that just
  broke). Con: web-only; re-runs tests already run by CI (~1–2s, negligible).
- Gating wa-bot/wa-gateway this way is impractical: their builds run from `apps/*` rootDirs and
  would need `cd ../.. && npm install && npm test` (installs the whole root, runs unrelated tests).

**C. Both** — B in code + A in the dashboard. Strongest; redundant on web but nothing slips through.

## Recommendation (tentative)
- If the real concern is "don't ship broken **web** logic" (what just happened): **B alone** fully
  addresses it and is 100% in-code/reliable.
- If the intent is the literal blanket "**nothing** deploys on red tests" across all 3 services:
  **C** — codify B for web, and enable A in the dashboard for all services.

## Open questions for next session
1. **Scope:** gate only `galiluz-web` (where the unit suite applies), or all 3 services?
2. **Mechanism:** in-code build gate (B), Render CI-wait (A), or both (C)?
3. Are you OK toggling the Render dashboard setting? (Required for A/C — I can't do it from here.)
4. Longer term: add dedicated tests for wa-bot / wa-gateway? They're currently uncovered by the suite.

## Files involved
- [.github/workflows/ci.yml](../.github/workflows/ci.yml) — CI (already runs `npm test` + build)
- [render.yaml](../render.yaml) — Render Blueprint; `galiluz-web` buildCommand (~line 24)
- [vitest.config.ts](../vitest.config.ts) — `include`/`exclude` (eval excluded)
- `package.json` — `scripts.test` = `vitest run`

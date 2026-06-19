# Environment variables & Render env-var groups

Single source of truth for how every env var in the monorepo is organized into Render **environment-variable groups** and which group attaches to which service.

> **Scope:** covers the three actively managed services — `galiluz-web`, `galiluz-wa-bot`, `galiluz-wa-gateway`. The old `galiluz-wa` Baileys listener is **legacy and unmanaged** — it has no groups here.

## Principles

- **Group kinds:**
  - `galiluz-core` — the one cross-app secret (`API_SECRET`).
  - `galiluz-int-*` — **integration** groups: the credentials/endpoints for one external service, set identically everywhere they're used.
  - `galiluz-app-*` — **app** groups: config unique to one service (including per-app tuning like which OpenAI model / Cloudinary folder).
- **Every var lives in exactly one group.** Render errors if two groups attached to the same service define the same key — this layout guarantees no overlap (see the per-service key lists below).
- **Runtime vars are set inline** on each service, not in a group: `NODE_ENV=production`, `NODE_VERSION=22`.
- **Optional vars with safe code defaults are not set** (all `MONGODB_COLLECTION_*`, etc.) — rely on defaults.
- **Secrets** use `sync: false` in render.yaml (entered by hand in the dashboard); stable public values are hardcoded.

## Group → service matrix

| Group | galiluz-web | galiluz-wa-bot | galiluz-wa-gateway |
|---|:-:|:-:|:-:|
| `galiluz-core` | ✅ | ✅ | ✅ |
| `galiluz-int-mongodb` | ✅ | | |
| `galiluz-int-cloudinary` | ✅ | | |
| `galiluz-int-openai` | ✅ | ✅ | |
| `galiluz-int-green-api` | | | ✅ |
| `galiluz-int-whatsapp-cloud` | | ✅ | |
| `galiluz-int-zoho-smtp` | ✅ | | |
| `galiluz-int-turnstile` | ✅ | | |
| `galiluz-int-posthog` | ✅ | | |
| `galiluz-app-web` | ✅ | | |
| `galiluz-app-wa-bot` | | ✅ | |
| `galiluz-app-wa-gateway` | | | ✅ |

Why the gaps: **wa-bot** talks to the web app over REST, so it needs no Mongo/Cloudinary; the **gateway** uses Green API's hosted session, so it needs no Mongo (that's future).

## Groups & values — apply checklist

Create each group, add its variables, and set the value. **Value** column: a literal value = type it exactly; `🔒 enter` = secret, paste from your existing groups; `(blank/optional)` = leave empty unless used.

| Group | Variable | Value | Notes |
|---|---|---|---|
| **galiluz-core** | `API_SECRET` | 🔒 enter | ≥16 chars; shared by web + wa-bot + wa-gateway |
| **galiluz-int-mongodb** | `MONGODB_URI` | 🔒 enter | |
| | `MONGODB_DB_NAME` | enter | prod, e.g. `valley_luz_app` |
| **galiluz-int-cloudinary** | `CLOUDINARY_CLOUD_NAME` | enter | |
| | `CLOUDINARY_API_KEY` | 🔒 enter | |
| | `CLOUDINARY_API_SECRET` | 🔒 enter | |
| | `CLOUDINARY_FOLDER` | enter | e.g. `galiluz` |
| **galiluz-int-openai** | `OPENAI_API_KEY` | 🔒 enter | |
| | `OPENAI_MODEL` | `gpt-4o-mini` | wa-bot pipeline + web fallback |
| | `OPENAI_MODEL_WEB` | `gpt-4o` | web AI event-generation |
| **galiluz-int-green-api** | `GREEN_API_ID_INSTANCE` | 🔒 enter | paid instance |
| | `GREEN_API_API_TOKEN_INSTANCE` | 🔒 enter | paid instance |
| | `GREEN_API_BASE_URL` | (blank/optional) | only if instance uses a custom host |
| | `GREEN_API_MEDIA_URL` | (blank/optional) | |
| **galiluz-int-whatsapp-cloud** | `WA_CLOUD_ACCESS_TOKEN` | 🔒 enter | |
| | `WA_PHONE_NUMBER_ID` | enter | |
| | `WEBHOOK_VERIFY_TOKEN` | 🔒 enter | |
| | `APP_SECRET` | 🔒 enter | Meta app secret (webhook signature) — **NOT** `API_SECRET` |
| | `WHATSAPP_TEST_PHONE_NUMBER_ID` | (blank/optional) | |
| | `WHATSAPP_PROD_PHONE_NUMBER_ID` | (blank/optional) | |
| **galiluz-int-zoho-smtp** | `SMTP_HOST` | `smtppro.zoho.com` | |
| | `SMTP_PORT` | `465` | |
| | `SMTP_USER` | enter | |
| | `SMTP_PASS` | 🔒 enter | Zoho app password |
| | `MAIL_FROM` | enter | e.g. `noreply@galiluz.co.il` |
| | `MAIL_TO` | enter | |
| **galiluz-int-turnstile** | `TURNSTILE_SECRET_KEY` | 🔒 enter | set with the site key, or neither |
| | `NUXT_PUBLIC_TURNSTILE_SITE_KEY` | enter | |
| **galiluz-int-posthog** | `NUXT_PUBLIC_POSTHOG_PUBLIC_KEY` | enter | |
| | `NUXT_PUBLIC_POSTHOG_HOST` | `https://eu.i.posthog.com` | |
| | `NUXT_PUBLIC_POSTHOG_DEFAULTS` | `2026-01-30` | |
| | `NUXT_PUBLIC_POSTHOG_IN_DEV` | `false` | |
| **galiluz-app-web** | `OTP_SECRET` | 🔒 enter | ≥32 chars |
| | `WA_GATEWAY_URL` | enter | gateway URL, e.g. `https://galiluz-wa-gateway.onrender.com` |
| | `NUXT_PUBLIC_SITE_URL` | `https://galiluz.co.il` | |
| **galiluz-app-wa-bot** | `GALILUZ_APP_URL` | `https://galiluz.co.il` | |
| | `PUBLISHERS_APPROVER_WA_NUMBER` | enter | |
| | `APPROVER_REENGAGEMENT_TEMPLATE_NAME` | (blank/optional) | |
| | `APPROVER_REENGAGEMENT_TEMPLATE_LANGUAGE` | `he` | |
| | `LOG_LEVEL` | `info` | |
| | `ALLOW_MAIN_MENU_FREE_LANGUAGE` | `true` | |
| **galiluz-app-wa-gateway** | `WA_LOG_LEVEL` | `info` | (`PORT` is auto-assigned by Render) |

Optional web ops add-ons, not grouped (add directly to `galiluz-web` only if used): `RATE_LIMIT_FILE_PATH`, `SENTRY_DSN`.

## Resolved key set per service (collision check)

Each service's keys = inline + the union of its attached groups. No key repeats within a service:

- **galiluz-web**: NODE_ENV, NODE_VERSION · API_SECRET · MONGODB_URI, MONGODB_DB_NAME · CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_FOLDER · OPENAI_API_KEY, OPENAI_MODEL, OPENAI_MODEL_WEB · SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO · TURNSTILE_SECRET_KEY, NUXT_PUBLIC_TURNSTILE_SITE_KEY · NUXT_PUBLIC_POSTHOG_* · OTP_SECRET, WA_GATEWAY_URL, NUXT_PUBLIC_SITE_URL
- **galiluz-wa-bot**: NODE_ENV, NODE_VERSION · API_SECRET · OPENAI_API_KEY, OPENAI_MODEL, OPENAI_MODEL_WEB* · WA_CLOUD_ACCESS_TOKEN, WA_PHONE_NUMBER_ID, WEBHOOK_VERIFY_TOKEN, APP_SECRET, WHATSAPP_*_PHONE_NUMBER_ID · GALILUZ_APP_URL, PUBLISHERS_APPROVER_WA_NUMBER, APPROVER_REENGAGEMENT_TEMPLATE_*, LOG_LEVEL, ALLOW_MAIN_MENU_FREE_LANGUAGE
- **galiluz-wa-gateway**: NODE_ENV, NODE_VERSION · API_SECRET · GREEN_API_* · WA_LOG_LEVEL

No key repeats within a service. (* wa-bot inherits `OPENAI_MODEL_WEB` from the shared `galiluz-int-openai` group but doesn't read it — harmless.)

## Dev-only vars (local `.env` only — never on Render)

`ALLOW_FIXED_DEV_OTP` (forces OTP `111111`), `WHATSAPP_DEV_FORWARD_ENABLED` / `WHATSAPP_DEV_FORWARD_URL` / `WHATSAPP_DEV_FORWARD_PATH` (wa-bot local webhook tunneling).

## Applying in Render (one-time migration)

Render env-group names are account-global and the old groups (`galiluz-shared`, `galiluz-wa-bot-secrets`, `galiluz-wa-gateway-secrets`) hold live secret values:

1. Create the 12 groups above; copy each secret value from the corresponding old group.
2. Attach groups to services per the matrix; keep inline `NODE_ENV`/`NODE_VERSION`.
3. Once nothing references them, delete the old groups — including `galiluz-wa-secrets` and the legacy `galiluz-wa` listener service itself, if you're retiring it.
4. Redeploy each service and confirm it boots (startup requirements: [startup-checks.ts](../server/plugins/startup-checks.ts) for web; each app's `src/config.js` otherwise).

Syncing the render.yaml blueprint creates the group/attachment shells, but `sync: false` values must still be entered manually — and a sync will **not** touch the unmanaged `galiluz-wa` service.

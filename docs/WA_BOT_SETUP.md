# wa-bot (WhatsApp Cloud API) – Setup

wa-bot is a small web service that receives WhatsApp Cloud API webhooks and can send event listings from the Galiluz app.

**Events API:** wa-bot fetches events from `GALILUZ_APP_URL/api/events`. That API is protected by the same secret as other internal APIs. Set `GALILUZ_APP_API_KEY` (or `API_SECRET`) in wa-bot to the same value as `API_SECRET` on the Nuxt app so wa-bot can call the events API. The API supports optional query params: `dates` (comma-separated YYYY-MM-DD, Israel) and `categories` (comma-separated category ids). When omitted, it returns the full active list; wa-bot passes `dates` and `categories` to get filtered results from the server.

## Required in Meta

1. **Phone number ID** – In [Meta for Developers](https://developers.facebook.com) → Your App → WhatsApp → API Setup, copy **Phone number ID** into `WA_PHONE_NUMBER_ID` in `.env` (and in Render env for **galiluz-wa-bot**).
2. **Webhook URL** – The URL Meta will call for verification and incoming messages.
3. **Verify token** – Must be identical in Meta and in your env.

## Local development

1. Create `apps/wa-bot/.env` with the required vars (see Production for keys).
2. Set `WA_PHONE_NUMBER_ID` from Meta API Setup.
3. **Publishers and dev database:** In development, wa-bot defaults `GALILUZ_APP_URL` to `http://localhost:3000`, so publisher check/register/approve/reject call your **local** Nuxt app, which uses the dev MongoDB from the root `.env` (`MONGODB_DB_NAME=valley_luz_app_dev`). Set `PUBLISHERS_APPROVER_WA_NUMBER` in `apps/wa-bot/.env` to your dev approver WhatsApp number. Run the Nuxt app (`npm run dev` in repo root) so the publishers API is available at localhost:3000.
4. Run: `cd apps/wa-bot && npm install && npm run dev`.
5. Expose your server to the internet (Meta requires HTTPS):
   - **ngrok**: `ngrok http 3001` → use the `https://…` URL.
   - **localtunnel**: `npx localtunnel --port 3001`.
6. In Meta: WhatsApp → Configuration → Webhook:
   - Callback URL: `https://<your-ngrok-or-tunnel-host>/webhook`
   - Verify token: same value as `WEBHOOK_VERIFY_TOKEN` in `.env`.
   - Subscribe to **messages**.

## Production (Render)

1. In Render, ensure the **galiluz-wa-bot** service exists (from `render.yaml`).
2. **Build:** wa-bot depends on the shared package `packages/event-format` via `file:../../packages/event-format`. Render runs `npm install` from `apps/wa-bot` (rootDir). The repo must be cloned in full (no shallow clone that omits `packages/`) so the file dependency resolves.
3. In the **galiluz-wa-bot-secrets** env group, set:
   - `WEBHOOK_VERIFY_TOKEN` (same as in Meta).
   - `WA_CLOUD_ACCESS_TOKEN` (use a permanent token for production).
   - `WA_PHONE_NUMBER_ID`.
   - `GALILUZ_APP_API_KEY` (same value as `API_SECRET` on galiluz-web, so wa-bot can call the events API).
   - `OPENAI_API_KEY` and `OPENAI_MODEL` (event formatting runs in wa-bot; use your own OpenAI key for the bot).
   - **Optional:** `PUBLISHERS_APPROVER_WA_NUMBER` – WhatsApp number (digits only, e.g. `972507153850`) of the person who approves new publishers; when set, they receive approval requests with Approve/Reject buttons.
   - **Optional (recommended if using approver):** `APPROVER_REENGAGEMENT_TEMPLATE_NAME` and `APPROVER_REENGAGEMENT_TEMPLATE_LANGUAGE` – When the approval message fails with WhatsApp error 131047 (user has not chatted in 24h), the bot sends a pre-approved template to the approver; when they reply, they get the approval buttons. Create the template in Meta: WhatsApp Manager → Message templates → Create. Example body (Hebrew): "יש לך בקשת מפרסם חדש. השב להודעה זו כדי לפתוח את הצ'אט ולאשר או לדחות." Set template name in APPROVER_REENGAGEMENT_TEMPLATE_NAME (e.g. approver_new_publisher_request) and language in APPROVER_REENGAGEMENT_TEMPLATE_LANGUAGE (default he). If not set, approval requests that hit 131047 will not be delivered. The code sends the template with a quick reply button component if your template has one.

**Note:** galiluz-web (Nuxt) does not use OpenAI; only wa-bot and the listener do, each with their own keys (wa-bot in galiluz-wa-bot-secrets, listener in galiluz-wa-secrets).
4. Webhook URL in Meta: `https://<galiluz-wa-bot>.onrender.com/webhook` (replace with your actual Render service URL).
5. Verify token in Meta must match `WEBHOOK_VERIFY_TOKEN`.

## Endpoints

- `GET /webhook` – Meta webhook verification (hub.mode=subscribe, hub.verify_token, hub.challenge).
- `POST /webhook` – Incoming messages; replies "Hello World" to private chats only.
- `GET /health` – Health check (used by Render).

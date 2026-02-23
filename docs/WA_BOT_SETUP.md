# wa-bot (WhatsApp Cloud API) – Setup

wa-bot is a small web service that receives WhatsApp Cloud API webhooks and can send event listings from the Galiluz app.

**Events API:** wa-bot fetches events from `GALILUZ_APP_URL/api/events`. That API is protected by the same secret as other internal APIs. Set `GALILUZ_APP_API_KEY` (or `API_SECRET`) in wa-bot to the same value as `API_SECRET` on the Nuxt app so wa-bot can call the events API. The API supports optional query params: `dates` (comma-separated YYYY-MM-DD, Israel) and `categories` (comma-separated category ids). When omitted, it returns the full active list; wa-bot passes `dates` and `categories` to get filtered results from the server.

## Required in Meta

1. **Phone number ID** – In [Meta for Developers](https://developers.facebook.com) → Your App → WhatsApp → API Setup, copy **Phone number ID** into `WA_PHONE_NUMBER_ID` in `.env` (and in Render env for **galiluz-wa-bot**).
2. **Webhook URL** – The URL Meta will call for verification and incoming messages.
3. **Verify token** – Must be identical in Meta and in your env.

## Local development

1. Copy `apps/wa-bot/.env.example` to `apps/wa-bot/.env` (or use the existing `.env` if already filled).
2. Set `WA_PHONE_NUMBER_ID` from Meta API Setup.
3. Run: `cd apps/wa-bot && npm install && npm run dev`.
4. Expose your server to the internet (Meta requires HTTPS):
   - **ngrok**: `ngrok http 3001` → use the `https://…` URL.
   - **localtunnel**: `npx localtunnel --port 3001`.
5. In Meta: WhatsApp → Configuration → Webhook:
   - Callback URL: `https://<your-ngrok-or-tunnel-host>/webhook`
   - Verify token: same value as `WEBHOOK_VERIFY_TOKEN` in `.env`.
   - Subscribe to **messages**.

## Production (Render)

1. In Render, ensure the **galiluz-wa-bot** service exists (from `render.yaml`).
2. In the **galiluz-wa-bot-secrets** env group, set:
   - `WEBHOOK_VERIFY_TOKEN` (same as in Meta).
   - `WA_CLOUD_ACCESS_TOKEN` (use a permanent token for production).
   - `WA_PHONE_NUMBER_ID`.
   - `GALILUZ_APP_API_KEY` (same value as `API_SECRET` on galiluz-web, so wa-bot can call the events API).
3. Webhook URL in Meta: `https://<galiluz-wa-bot>.onrender.com/webhook` (replace with your actual Render service URL).
4. Verify token in Meta must match `WEBHOOK_VERIFY_TOKEN`.

## Endpoints

- `GET /webhook` – Meta webhook verification (hub.mode=subscribe, hub.verify_token, hub.challenge).
- `POST /webhook` – Incoming messages; replies "Hello World" to private chats only.
- `GET /health` – Health check (used by Render).

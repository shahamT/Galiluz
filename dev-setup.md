# Local Development & Testing Guide

## Overview

Three services make up the system:
- **Nuxt app** — frontend + API server (port 3000)
- **wa-bot** — WhatsApp webhook processor (port 3001)
- **MongoDB** — shared between both; dev uses `valley_luz_app_dev`, prod uses `valley_luz_app`

---

## Running the UI Locally

```bash
npm run dev
```

Opens at `http://localhost:3000`. Reads from the **dev MongoDB** (`valley_luz_app_dev`).

> **Note:** `npm run dev` runs `node scripts/dev.js` which starts both Vite and the Nitro server together. The old `npm run dev:web` alias also works but `npm run dev` is the standard command.

This DB is separate from production, so any events you create locally won't affect the live site. If you want to see production data in the local UI, change `MONGODB_DB_NAME=valley_luz_app` in the root `.env` — but be careful, writes go to production too.

---

## Running the wa-bot Locally

```bash
npm run dev:wa-bot
```

Starts the webhook server on port 3001. In dev mode it automatically talks to `http://localhost:3000` (the local Nuxt app), so both need to be running together.

---

## Testing the Bot with Real WhatsApp Messages

WhatsApp requires a public HTTPS URL. You have two options:

---

### Option A — ngrok (simple, webhook URL change required)

1. Run the bot locally: `npm run dev:wa-bot`
2. Expose it: `npm run dev:ngrok` → gives you `https://xxxx.ngrok-free.app`
3. Go to [Meta Business Manager → WhatsApp → Configuration](https://business.facebook.com) and change the webhook URL to the ngrok address
4. Send messages from your WhatsApp to the business number — they hit the local bot

**Downside:** You have to change the webhook URL in Meta every time, and if the production bot is running it won't receive anything while you're testing.

---

### Option B — Dev Forwarding (recommended, no webhook URL change)

This is the built-in mechanism. The **production bot** automatically forwards messages from a dedicated test phone number to your local dev bot, without you having to touch the Meta webhook URL.

#### How it works

```
User sends WhatsApp to test number
  → Meta sends webhook to production server
  → Production bot checks: is this the test phone ID?
  → YES: fire-and-forget forward to ngrok URL → your local bot handles it
  → NO: production bot handles it normally
```

The local bot responds directly to WhatsApp Cloud API, so the user sees the reply.

#### What you need

**Step 1 — Get a test WhatsApp phone number**

You need a second phone number registered in Meta Business Manager with its own Phone Number ID. This is separate from the production number.

- Production Phone Number ID: `1028248877037153` (currently in `apps/wa-bot/.env` as `WA_PHONE_NUMBER_ID`)
- Test Phone Number ID: needs to be set up in Meta — check Business Manager for any additional numbers

**Step 2 — Start ngrok**

```bash
npm run dev:ngrok
# Note the URL, e.g. https://abc123.ngrok-free.app
```

**Step 3 — Configure the production bot's `.env`**

Add to `apps/wa-bot/.env`:
```bash
WHATSAPP_TEST_PHONE_NUMBER_ID=<test_phone_number_id_from_meta>
WHATSAPP_DEV_FORWARD_ENABLED=true
WHATSAPP_DEV_FORWARD_URL=https://abc123.ngrok-free.app
WHATSAPP_DEV_FORWARD_PATH=/webhook
```

Restart the production bot on Render (or trigger a deploy) after changing these.

**Step 4 — Start local bot**

```bash
npm run dev:wa-bot
```

**Step 5 — Test**

Send a WhatsApp message to the **test number** (not the production number). The production bot receives it, recognizes the test phone ID, and forwards it to your local ngrok URL. Your local bot processes it and replies.

The production number continues working normally for real users during this time.

---

## Current Status of Dev Forwarding

Forwarding is **not yet configured**. The env vars needed are currently missing from `apps/wa-bot/.env`:

| Env Var | Status | What's needed |
|---|---|---|
| `WHATSAPP_TEST_PHONE_NUMBER_ID` | ❌ Not set | The Phone Number ID of your test WhatsApp number from Meta |
| `WHATSAPP_DEV_FORWARD_ENABLED` | ❌ Not set | Set to `true` to enable forwarding |
| `WHATSAPP_DEV_FORWARD_URL` | ❌ Not set | Your ngrok URL (changes each session) |
| `WHATSAPP_PROD_PHONE_NUMBER_ID` | ❌ Not set | Optional — the production phone ID (for logging) |

---

## Database Environments

| Environment | MongoDB DB Name | Set in |
|---|---|---|
| Local dev | `valley_luz_app_dev` | Root `.env` → `MONGODB_DB_NAME` |
| Production | `valley_luz_app` | Render env vars |

To switch local UI to read production data: change `MONGODB_DB_NAME=valley_luz_app` in root `.env`. **Only do this to read — never run the bot pointed at prod DB locally.**

---

## Quick Reference: Which Service Uses What

| | Local Nuxt URL | MongoDB |
|---|---|---|
| `npm run dev` | `http://localhost:3000` | `valley_luz_app_dev` |
| `npm run dev:wa-bot` | talks to localhost:3000 | via Nuxt API |
| Production | `https://galiluz.co.il` | `valley_luz_app` |

---

## Testing the Publisher Portal

The publisher portal lives at `/publisher/dashboard` and requires authentication.

### Logging in locally

1. Start the app: `npm run dev`
2. Go to `http://localhost:3000/login`
3. Enter your phone number (must exist in the `publishers` collection with `status: 'approved'`)
4. **OTP in dev mode:** If `WA_ACCESS_TOKEN` or `WA_PHONE_NUMBER_ID` are not set in the root `.env`, the OTP is **not sent via WhatsApp** and is instead printed to the Nitro console:
   ```
   [Auth][DEV] OTP for 972507153850: 123456
   ```
5. Enter the code and you're in.

### Adding a publisher for testing

Connect to the dev MongoDB and insert a document into the `publishers` collection:

```js
db.publishers.insertOne({
  waId: "972507153850",   // phone in international format, digits only
  fullName: "Test Publisher",
  publishingAs: "Test Org",
  status: "approved",
  type: "publisher",
  createdAt: new Date()
})
```

### Manager access

Set `type: "manager"` to get unrestricted access to all publisher events and the admin panel.

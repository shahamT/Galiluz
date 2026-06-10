# Security and API Budget

## Publisher authentication

Publishers log in via WhatsApp OTP. The session is stored in a secure cookie.

### Flow

1. `POST /api/auth/send-otp` — generates a 6-digit OTP, stores its HMAC-SHA256 hash (`authKey`) in the publisher's MongoDB document with a 10-minute expiry (`otpExpiresAt`). In production the OTP is sent via WhatsApp Cloud API; in dev (no WA credentials) it is logged to the Nitro console.
2. `POST /api/auth/verify-otp` — checks the hash, then creates a 1-hour session: generates a random token, stores its hash (`authKey`) with `authKeyExpiresAt = now + 1h`, and sets the `galiluz_auth` HttpOnly cookie (`Secure; SameSite=Strict`).
3. Subsequent requests include the cookie automatically. `requirePublisherAuth(event)` in `server/utils/requirePublisherAuth.ts`:
   - Reads token from `galiluz_auth` cookie (browser) or `Authorization: Bearer` header (internal tools).
   - Hashes with HMAC-SHA256 using `OTP_SECRET` env var.
   - Queries MongoDB: `{ authKey: hash, authKeyExpiresAt: { $gt: now } }`.
   - Requires `status === 'approved'` on the publisher record.
   - Uses timing-safe comparison to prevent length-based timing attacks.
   - Returns a `PublisherSession` (`{ publisherId, waId, fullName, publishingAs, type }`).

### Resource ownership

- **Publishers** can only read/write their own events. Endpoints enforce `doc.event.publisherId === session.publisherId`.
- **Managers** (`session.type === 'manager'`) bypass the ownership check and can act on any event.

### 401 handling on the client

`composables/useAuthFetch.js` wraps `useFetch` with `server: false` (prevents SSR from making authenticated requests with a missing cookie) and an `onResponseError` hook that calls `authStore.logout()` and navigates to `/login` on any 401 response.

---

## Media upload security

`POST /api/publisher/media` accepts a base64-encoded file (JSON body `{ file, mimetype, filename }`). Before uploading to Cloudinary:

1. **MIME type whitelist** — Only `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/heic/heif`, `video/mp4`, `video/quicktime`, `video/webm`, and a few other video types.
2. **Extension whitelist** — Only `jpg`, `jpeg`, `png`, `gif`, `webp`, `heic`, `heif`, `mp4`, `mov`, `avi`, `mkv`, `webm`, `m4v`. SVG is explicitly excluded (can contain embedded JavaScript).
3. **Double-extension attack prevention** — `malware.php.jpg` is rejected (checks second-to-last extension against a dangerous-extensions list).
4. **Size limit** — 20 MB maximum.
5. **Magic byte validation** — For images, the first 12 bytes are checked against known signatures: JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), GIF (`47 49 46 38`), WebP (`52 49 46 46 … 57 45 42 50`). HEIC/HEIF and video files skip this check.

### HTML sanitization

`server/utils/sanitizeEventFields.ts` is called before validation on all create/update requests:

- Plain-text fields (`title`, `shortDescription`, location strings) — all HTML tags stripped.
- `fullDescription` — only a safe whitelist of tags is kept (`p`, `br`, `strong`, `em`, `del`, `code`, `pre`, `blockquote`, `ul`, `ol`, `li`); all attributes are stripped; `<script>`, `<style>`, `<iframe>`, and similar dangerous tags are removed along with their content.
- `safeUrl()` — used for `wazeNavLink`, `gmapsNavLink`, and `urls[].Url`: rejects anything whose URL scheme is not `http:` or `https:` (blocks `javascript:`, `data:`, etc.).

---

## API secret (production)

The Nuxt API routes `/api/whatsapp-messages` and `/api/whatsapp-media/[filename]` are protected by an API secret.

- **Env:** `API_SECRET` (server-side, e.g. in `.env` or deployment env).
- **Production:** In production (`NODE_ENV=production`), `API_SECRET` is **required**. If it is not set, requests to these routes receive **503 Service Unavailable** until the secret is configured.
- **How to send the secret (preferred):** Use the **header** `X-API-Key: <your-secret>` so the value is not logged in URLs or Referer. Avoid passing the secret in the query string (`?apiKey=...`); if you must, be aware it can appear in server logs, Referer headers, and browser history.
- **Value:** Use a long, random string (e.g. 32+ characters). Generate one with: `openssl rand -hex 32` or a password manager. Keep it out of client-side code and do not commit it to the repo.

### Where to set API_SECRET on Render

- **Environment group:** **galiluz-shared** (used by the Nuxt web service `galiluz-web`).
- **Steps:** Dashboard → Environment Groups → **galiluz-shared** → Add Variable (or edit if the key was added via the blueprint): key `API_SECRET`, value = your long random secret.
- **What the value should be:** A single random string, no spaces. Example: run `openssl rand -hex 32` in a terminal and paste the output (64 hex characters). Anyone calling `/api/whatsapp-messages` or `/api/whatsapp-media/...` must send that same value in the `X-API-Key` header.

## Monthly API budget (wa-listener)

To cap spending on OpenAI and Google Vision, the wa-listener can enforce monthly limits. When a limit is exceeded, the pipeline skips processing new messages and logs `BUDGET_LIMIT_EXCEEDED` (no API calls are made for that message).

- **Env (in `apps/wa-listener/.env`):**
  - `MONTHLY_OPENAI_CALL_LIMIT` – Max OpenAI API calls per calendar month (e.g. `1500`). `0` or unset = no limit.
  - `MONTHLY_GOOGLE_VISION_LIMIT` – Max Google Vision (document text detection) calls per calendar month (e.g. `7700`). `0` or unset = no limit.
- **Storage:** Usage is stored in MongoDB in the `api_usage` collection (or the name set by `MONGODB_COLLECTION_API_USAGE`). One document per month key (`YYYY-MM`) with `openaiCalls` and `googleVisionCalls`.
- **Behavior:** Before each pipeline run, the service checks current month usage. If adding one more message would exceed either limit, the message is skipped and a log line is written. Normal operation is unchanged until a limit is hit.

## Rate limit persistence (Nuxt server)

Rate limiting for `/api/events`, `/api/whatsapp-messages`, and `/api/whatsapp-media` is applied per IP (100 requests per 60 seconds). By default the state is in-memory and resets on deploy.

- **Env:** `RATE_LIMIT_FILE_PATH` – If set, rate limit state is read/written to this JSON file so it survives restarts. Use a path on a persistent disk (e.g. the same volume used for wa-listener auth): e.g. `/data/rateLimit.json` or `./.data/rateLimit.json`.
- **Note:** For multiple Nuxt instances, use a shared store (e.g. Redis) or proxy-level rate limiting; file-based persistence is for a single instance.

## Events API

- **GET /api/events** – Public, no auth. Responses are limited to 500 documents and rate-limited per IP (same 100/min as above).

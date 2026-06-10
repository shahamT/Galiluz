# WhatsApp Message Service Documentation

## Overview

This is a WhatsApp message integration service that listens to WhatsApp group messages. The service runs as a separate Node.js service and stores incoming messages in MongoDB. Media files are automatically uploaded to Cloudinary.

## Architecture

- **WhatsApp Message Service**: Separate Node.js service in `apps/wa-listener/`
- **Nuxt API**: Endpoint at `/api/whatsapp-messages` to read messages from MongoDB
- **MongoDB**: Database storage for all messages
- **Cloudinary**: Cloud storage for media files

## Local Setup

### 1. Install Dependencies

```bash
cd apps/wa-listener
npm install
```

### 2. Configure Environment

Create a `.env` file in `apps/wa-listener` and configure:
- `NODE_ENV=development`
- `WA_DISCOVERY_MODE=true` (initially)
- Leave `WHATSAPP_GROUP_IDS` empty initially
- **MongoDB Configuration** (required):
  - `MONGODB_URI` - Your MongoDB connection string
  - `MONGODB_DB_NAME` - Your MongoDB database name
  - `MONGODB_COLLECTION_RAW_MESSAGES` - Collection name (defaults to `raw_messages`)
- **Cloudinary Configuration** (required for media uploads):
  - `CLOUDINARY_CLOUD_NAME` - Your Cloudinary cloud name (from dashboard)
  - `CLOUDINARY_API_KEY` - Your Cloudinary API key (from dashboard)
  - `CLOUDINARY_API_SECRET` - Your Cloudinary API secret (from dashboard)
  - `CLOUDINARY_FOLDER=whatsapp-listener` (optional, defaults to this)
- **Production / security:** See [SECURITY_AND_BUDGET.md](SECURITY_AND_BUDGET.md) for `API_SECRET` (Nuxt API protection) and optional monthly budget limits (`MONTHLY_OPENAI_CALL_LIMIT`, `MONTHLY_GOOGLE_VISION_LIMIT`) for the wa-listener.

### 3. Run the Service

```bash
# From apps/wa-listener directory
npm run dev

# Or from root directory
npm run dev:wa
```

### 4. Authenticate

1. A QR code will appear in the terminal
2. Open WhatsApp on your phone
3. Go to Settings → Linked Devices → Link a Device
4. Scan the QR code from the terminal
5. Wait for "Client is ready!" message

## Discovery Mode

Discovery mode helps you find the correct group ID.

### Step 1: Enable Discovery Mode

In `apps/wa-listener/.env`:
```
WA_DISCOVERY_MODE=true
WHATSAPP_GROUP_IDS=
```

### Step 2: Start the Service

```bash
npm run dev
```

### Step 3: View Available Groups

When the client is ready, it will automatically list all your groups with their IDs. You can also list groups on demand (same auth, no MongoDB): from `apps/wa-listener` run `npm run list-groups` to print all group names and IDs plus a ready-to-paste `WHATSAPP_GROUP_IDS=...` line for your `.env`.

### Step 4: Test Message

1. Send a test message in your target WhatsApp group
2. The service will print group metadata:
   - Group Name
   - Group ID (ends with @g.us)
   - Sender name
   - **Note**: Message content is NOT displayed for privacy

### Step 5: Copy Group ID

Copy the Group ID from the console output (it ends with `@g.us`).

## Locked Mode

After discovering the group ID, switch to locked mode.

### Step 1: Update Configuration

In `apps/wa-listener/.env`:
```
WA_DISCOVERY_MODE=false
WHATSAPP_GROUP_IDS=120363123456789012@g.us
```

Replace `120363123456789012@g.us` with your actual group ID. For multiple groups, use comma-separated values:
```
WHATSAPP_GROUP_IDS=120363123456789012@g.us,120363123456789013@g.us
```

### Step 2: Restart Service

```bash
# Stop the current service (Ctrl+C)
# Then restart
npm run dev
```

### Step 3: Verify

- The service should show: "Locked mode active - listening to group: [your-group-id]"
- Send a message in the target group
- Check MongoDB collection - it should contain the message

## Viewing Messages

### Via API

```bash
curl http://localhost:3000/api/whatsapp-messages?limit=50
```

The API endpoint reads from MongoDB and returns messages sorted by creation date (newest first).

## Running Both Services

### Option 1: Separate Terminals

```bash
# Terminal 1
npm run dev:web

# Terminal 2
npm run dev:wa
```

### Option 2: Manual Concurrent (if you have concurrently installed)

```bash
npm install -D concurrently
```

Then add to root `package.json`:
```json
"dev:all": "concurrently \"npm run dev:web\" \"npm run dev:wa\""
```

## Security Considerations

### Git Safety

**NEVER commit**:
- `apps/wa-listener/.env`
- `apps/wa-listener/auth/**` (WhatsApp session data)
- Any files containing API keys or secrets

These are automatically ignored by `.gitignore`.

### Production Safety

- **Fail Closed**: If `NODE_ENV=production` and `WHATSAPP_GROUP_IDS` is missing, the process will exit with an error
- **No Discovery in Production**: Discovery mode is disabled in production
- **QR in Production**: When auth is needed (first run or session expired), the QR code is shown in logs in both dev and production so you can authenticate; in production, check Render logs and use the raw QR data with an online QR generator if you cannot scan the terminal output

### Privacy

- Discovery mode prints only group metadata, never message content
- Message content is stored in MongoDB
- Media files are stored in Cloudinary

## Troubleshooting

### "Authentication failed"

**Solution**: Delete the auth folder and re-scan QR:
```bash
rm -rf apps/wa-listener/auth
# Then restart the service
```

### "Multiple sessions detected"

**Solution**: Ensure only one service process is running. Check for running Node processes:
```bash
# Windows
tasklist | findstr node

# Linux/Mac
ps aux | grep node
```

### "Group ID not found"

**Solution**: 
1. Verify the group ID is correct (ends with `@g.us`)
2. Make sure you're using the exact ID from discovery mode
3. Check that `WA_DISCOVERY_MODE=false` in `.env`

### Messages not appearing

**Check**:
1. Is the service running?
2. Is `WA_DISCOVERY_MODE=false`?
3. Is `WHATSAPP_GROUP_IDS` set correctly?
4. Check MongoDB connection and collection
5. Check console logs for errors
6. For media uploads: Is Cloudinary configured correctly?

### MongoDB Connection Issues

**Check**:
1. Is `MONGODB_URI` correctly formatted?
2. Is `MONGODB_DB_NAME` set?
3. Is MongoDB server accessible?
4. Check console logs for connection errors

## Message Format

Messages are stored in MongoDB with the following structure:

```json
{
  "createdAt": "2026-02-06T18:35:17.000Z",
  "cloudinaryUrl": "https://res.cloudinary.com/your-cloud/image/upload/whatsapp-listener/filename.jpg",
  "raw": {
    "id": {
      "_serialized": "true_120363123456789012@g.us_3EB0123456789ABCDE",
      "id": "3EB0123456789ABCDE"
    },
    "timestamp": 1770402917,
    "timestampISO": "2026-02-06T18:35:17.000Z",
    "from": "120363123456789012@g.us",
    "body": "Message text",
    "hasMedia": true,
    "type": "image",
    "chat": {
      "id": "120363123456789012@g.us",
      "name": "My Group",
      "isGroup": true
    },
    "cloudinaryUrl": "https://res.cloudinary.com/...",
    "cloudinaryData": {
      "url": "http://res.cloudinary.com/...",
      "secure_url": "https://res.cloudinary.com/...",
      "public_id": "whatsapp-listener/filename",
      "format": "jpg",
      "bytes": 123456
    }
  }
}
```

**Note**: Media files are automatically uploaded to Cloudinary. The `cloudinaryUrl` field contains the HTTPS URL to access the media file.

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Node environment | `development` | No |
| `WA_AUTH_PATH` | Path for WhatsApp auth data | `./auth` | No |
| `WHATSAPP_GROUP_IDS` | Target group IDs (comma-separated) | (empty) | Yes (production) |
| `WA_DISCOVERY_MODE` | Enable discovery mode | `true` | No |
| `WA_LOG_LEVEL` | Logging level | `info` | No |
| `MONGODB_URI` | MongoDB connection string | (empty) | Yes |
| `MONGODB_DB_NAME` | MongoDB database name | (empty) | Yes |
| `MONGODB_COLLECTION_RAW_MESSAGES` | MongoDB collection for raw messages | `raw_messages` | No |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | (empty) | Yes (for media upload) |
| `CLOUDINARY_API_KEY` | Cloudinary API key | (empty) | Yes (for media upload) |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | (empty) | Yes (for media upload) |
| `CLOUDINARY_FOLDER` | Cloudinary folder for uploads | `whatsapp-listener` | No |
| `OPENAI_API_KEY` | OpenAI API key for event extraction | — | Yes |
| `OPENAI_MODEL` | OpenAI model to use (e.g. `gpt-4o`) | — | Yes |
| `OCR_ENABLED` | Enable Google Vision OCR for image messages | `false` | No |
| `OCR_PROVIDER` | OCR provider (`google_vision`) | — | No |
| `OCR_FALLBACK_OPENAI_VISION` | Fall back to OpenAI Vision if Google Vision fails | `false` | No |
| `GOOGLE_CREDENTIALS_JSON` | Full Google service account key JSON (minified to one line) | — | Yes (if OCR enabled) |
| `MONTHLY_OPENAI_CALL_LIMIT` | Max OpenAI calls per calendar month (`0` = no limit) | `0` | No |
| `MONTHLY_GOOGLE_VISION_LIMIT` | Max Google Vision calls per calendar month (`0` = no limit) | `0` | No |
| `WHATSAPP_TEST_PHONE_NUMBER_ID` | Meta Phone Number ID of the test WhatsApp number for dev forwarding | — | No |
| `WHATSAPP_DEV_FORWARD_ENABLED` | Enable dev forwarding from production bot to local bot | `false` | No |
| `WHATSAPP_DEV_FORWARD_URL` | ngrok URL to forward test messages to (e.g. `https://abc.ngrok-free.app`) | — | No |

### Google Vision OCR (dev and production)

One approach everywhere: put the **entire Google service account key file JSON** in the env var `GOOGLE_CREDENTIALS_JSON`.

- **Local:** In `apps/wa-listener/.env`, set `GOOGLE_CREDENTIALS_JSON=` and paste the full key file content as **one line** (minify: remove newlines). Do not commit `.env`.
- **Render:** In **galiluz-wa** → **Environment**, add a **Secret** with key `GOOGLE_CREDENTIALS_JSON` and value = entire key file JSON (paste as-is or one line).

Also set: `OCR_ENABLED=true`, `OCR_PROVIDER=google_vision`, `OCR_FALLBACK_OPENAI_VISION=true`. No key file path is used.

## Cloudinary Media Storage

Media files from WhatsApp messages are automatically uploaded to Cloudinary:

- **Automatic Upload**: All media (images, videos, audio, documents) is uploaded to Cloudinary
- **Folder Organization**: All files are stored in the `whatsapp-listener/` folder (configurable via `CLOUDINARY_FOLDER`)
- **Direct Access**: Media URLs are stored in the message data and accessible via HTTPS
- **No Local Storage**: Media files are not saved locally
- **Cloudinary Dashboard**: View all uploaded media in your Cloudinary dashboard under the configured folder

### Getting Your Cloudinary Cloud Name

1. Log in to [Cloudinary Dashboard](https://cloudinary.com/console)
2. Your cloud name is displayed at the top of the dashboard
3. Add it to `.env` as `CLOUDINARY_CLOUD_NAME=your-cloud-name`

## Notes

- The service processes all message types including media
- Media files are uploaded to Cloudinary automatically
- Messages are stored in MongoDB with full raw data
- The API endpoint reads from MongoDB and returns messages sorted by creation date
- All logging goes through a structured logger service

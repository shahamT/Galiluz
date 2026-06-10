# Galiluz — גלילו"ז

Community events calendar for the Galilee region in northern Israel. Publishers create and manage events through a dedicated portal; visitors browse a public calendar filtered by date, category, and location.

---

## Services

| Service | Description | Port |
|---------|-------------|------|
| **Nuxt web app** | Frontend + REST API server | 3000 |
| **wa-bot** | WhatsApp Cloud API webhook — replies to user queries | 3001 |
| **wa-listener** | Baileys webhook processor — ingests events from WhatsApp groups | 3002 |

All three share a MongoDB Atlas cluster. Development uses the `valley_luz_app_dev` database; production uses `valley_luz_app`.

---

## Tech stack

- **Frontend:** Nuxt 3, Vue 3, Pinia, SCSS (BEM), Swiper, Floating Vue
- **Backend:** Nitro (Nuxt server), MongoDB Atlas, Cloudinary
- **AI/ML:** OpenAI (GPT-4o), Google Cloud Vision OCR
- **WhatsApp:** WhatsApp Cloud API (wa-bot), Baileys (wa-listener)
- **Rich text:** Tiptap
- **Auth:** OTP via WhatsApp → HttpOnly cookie
- **Hosting:** Render

---

## Quick start

```bash
# Install all workspace dependencies
npm install

# Start the Nuxt app (frontend + API, port 3000)
npm run dev

# Start the WhatsApp bot (port 3001)
npm run dev:wa-bot

# Start the WhatsApp listener (port 3002)
npm run dev:wa
```

Copy `.env.example` to `.env` in the repo root and fill in the required values before running.

---

## Key features

### Public calendar
- Monthly and daily views with swipe navigation
- Filter by category, region, and time of day
- Event modal with full details, navigation links, calendar add, and sharing
- URL-synced state (current date, active filters, open event)

### Publisher portal (`/publisher`)
- WhatsApp OTP login (no passwords)
- Dashboard with KPI cards, recent activity, and top events
- Events list with search and filter (future / past / all)
- Event detail page with embedded preview + statistics per occurrence
- Full create/edit form: rich text description, emoji picker, category picker, region map, media upload with video thumbnails, multi-occurrence scheduling
- Delete with name-confirmation safety modal

### WhatsApp event ingestion
- wa-listener monitors allowed WhatsApp groups
- Incoming messages are classified, extracted (OpenAI), validated, compared for duplicates, enriched, and persisted
- wa-bot handles direct user queries and the publisher onboarding/approval flow

---

## Directory structure

```
.
├── pages/              # Nuxt pages (public calendar + publisher portal)
├── components/         # Vue components
│   ├── publisher/      # Publisher portal components
│   ├── form/           # Form components (RichTextEditor, CityPicker, etc.)
│   ├── controls/       # Calendar header/nav
│   ├── layout/         # AppShell, ProtectedShell
│   └── ui/             # EventModal, filters, pickers
├── composables/        # Auto-imported composables (useAuthFetch, etc.)
├── stores/             # Pinia stores (calendar, ui, auth)
├── server/             # Nitro server
│   ├── api/            # REST endpoints
│   │   ├── publisher/  # Publisher-authenticated endpoints
│   │   └── internal/   # Internal API (Cloudinary upload, etc.)
│   └── utils/          # Server utilities (auth, validation, sanitization)
├── consts/             # Shared constants (EVENT_CATEGORIES, CITIES, etc.)
├── utils/              # Client utilities (date helpers, etc.)
├── apps/
│   ├── wa-bot/         # WhatsApp Cloud API bot
│   └── wa-listener/    # Baileys event ingestion service
├── packages/
│   └── event-format/   # Shared event formatting package
└── docs/               # Documentation
```

---

## Documentation

| Doc | Description |
|-----|-------------|
| [dev-setup.md](dev-setup.md) | Local development and testing guide |
| [RULES.md](RULES.md) | Code conventions |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Frontend architecture and flows |
| [docs/SECURITY_AND_BUDGET.md](docs/SECURITY_AND_BUDGET.md) | API security and budget limits |
| [docs/WA_BOT_SETUP.md](docs/WA_BOT_SETUP.md) | wa-bot setup and configuration |
| [docs/WHATSAPP_SERVICE.md](docs/WHATSAPP_SERVICE.md) | wa-listener setup and message format |
| [docs/EVENT_OBJECT_INTEGRATION.md](docs/EVENT_OBJECT_INTEGRATION.md) | WhatsApp → MongoDB event pipeline |
| [packages/event-format/FORMATTED_EVENT_CONTRACT.md](packages/event-format/FORMATTED_EVENT_CONTRACT.md) | Event schema contract |

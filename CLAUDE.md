# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev:web       # Start Nuxt dev server (localhost:3000)
npm run build         # Production build
npm run dev:wa        # Start WhatsApp listener
npm run dev:ngrok     # Expose port 3001 via ngrok
```

## Architecture

Nuxt 3 monorepo. The main web app is at the root. Supporting apps live under `apps/` (WhatsApp listener, WA bot). Shared event format types are in `packages/event-format/`.

- **Pages**: `pages/` — file-based routing. Publisher portal under `pages/publisher/`. Admin under `pages/admin/`.
- **Components**: `components/` — `ui/` for generic UI, `publisher/` for publisher portal, `form/` for form sub-components, `layout/` for shells/nav.
- **Composables**: `composables/` — all auto-imported. `useAuth.js` / `useAuthFetch.js` for auth. `useEventDraft.js` for localStorage draft persistence.
- **Server**: `server/api/` — Nitro API routes. Auth routes under `server/api/auth/`. Publisher routes under `server/api/publisher/`.
- **Stores**: Pinia stores (auto-imported). `useAuthStore` holds the logged-in user.
- **Styles**: `assets/css/variables.scss` — all CSS custom properties. `assets/css/breakpoints.scss` — `@include mobile` mixin.

## Auth

Uses an HttpOnly cookie (`galiluz_auth`). Login is OTP via WhatsApp.

- `useAuthFetch` wraps `useFetch` with automatic 401 → logout handling.
- Direct `$fetch()` calls do NOT get automatic 401 handling — catch manually.
- **Local OTP testing**: In dev mode the OTP is never sent via WhatsApp. It is logged to the Nuxt dev server terminal as `[Auth][DEV] OTP for 972XXXXXXXXX: XXXXXX`. Read it from the server output.

## Layout

Hebrew RTL. Flex row direction means first DOM child = rightmost visually. Use CSS `order` to reposition elements within RTL flex containers.

## Key conventions

- Vue 3 `<script setup>` throughout.
- SCSS BEM naming (e.g. `.ComponentName-element--modifier`).
- `v-if` to fully hide elements; `disabled` only when the element should remain in the DOM.

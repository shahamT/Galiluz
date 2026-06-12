# Galiluz Native Apps via Capacitor — Bundled SPA, Web Stays Primary

## Context & decisions (user-confirmed)

Ship Galiluz as installable iOS + Android apps **alongside** the existing SSR web app (untouched, same repo). Architecture: **bundled SPA** — a second Nuxt build target (`ssr: false`, static) packaged inside the native binary, calling the production API at `https://galiluz.co.il`. **v1 without push notifications** (native share / calendar / haptics as the native value); push is the v2 lever if Apple pushes back. **Both platforms built from day one**; Android releases first in practice (no Mac yet — iOS binary via cloud build or borrowed Mac when the Apple account exists).

**Stack facts (researched, June 2026):** Capacitor 8 (Dec 2025) — iOS 15+, Android API 23+, Xcode 16+, Android Studio 2025.2.1+, built-in Android edge-to-edge. `CapacitorHttp` patches `fetch` to native networking with a **native first-party cookie jar** — HttpOnly session cookies against a remote API work, no CORS involved (no browser preflight), unaffected by `SameSite`.

## Codebase blockers found (scan)

1. **All API calls are relative `/api/...`** (useEvents/useCategories useFetch, useAuthFetch, raw `$fetch` in useAuth/useEventTracking/useEventMetaForSeo/EventFormModal/FeedbackModal…). In the app they must hit `https://galiluz.co.il`.
2. **Auth cookie** `galiluz_auth` is `SameSite=Strict; path=/api` — dead on arrival from a `capacitor://localhost` WebView via normal fetch. Solved by CapacitorHttp's native cookie jar.
3. **CSRF origin check** in send-otp/verify-otp requires `Origin === Host` in production → would 403 the app. Needs an explicit allowlist for app origins (`capacitor://localhost`, `https://localhost`) — sound, since CSRF is a browser-cookie attack class; native requests aren't in it.
4. **Turnstile on login** inside the WebView runs on hostname `localhost` — already in the widget allowlist; needs a device test, with a documented fallback (below).
5. **PWA machinery must hide in-app**: UiInstallBanner / useInstallPrompt / install menu item, `plugins/sw.client.js` service-worker registration, manifest/apple meta.
6. **Absolute-URL builders use `window.location.origin`** ([EventModalActions.vue:107](components/ui/EventModalActions.vue#L107) share URL, [posthog.client.js:25](plugins/posthog.client.js#L25), [publisher/events/[id].vue:360](pages/publisher/events/[id].vue#L360)) — in-app that's `capacitor://localhost`; must use a canonical `siteUrl` so shared links point at the website.
7. SSR-only niceties degrade harmlessly in the SPA (no 302 index-redirect — client middleware still redirects; no SSR og-meta — irrelevant in-app; events fetched client-side — already the hydration path).

## Implementation phases

### Phase A — Dual-build foundation (web behavior unchanged)
- `nuxt.config.ts`: branch on `process.env.BUILD_TARGET === 'capacitor'` → `ssr: false`, viewport `viewport-fit=cover`, skip nitro header rules. Add `public.apiBase` (default `''`) and `public.siteUrl` (default `https://galiluz.co.il`).
- API base wiring: a client plugin for the capacitor target that creates the app-wide `$fetch` with `baseURL: apiBase` + passes `baseURL` into the `useFetch` wrappers (useEvents/useCategories/useAuthFetch). Replace the three `window.location.origin` builders with `siteUrl`-based helper.
- `package.json`: `build:app` script (`BUILD_TARGET=capacitor nuxt generate`).

### Phase B — Capacitor shell
- `npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios @capacitor/status-bar @capacitor/splash-screen @capacitor/app`.
- `capacitor.config.ts`: `appId: 'il.co.galiluz.app'`, `webDir` = generate output, **`plugins.CapacitorHttp.enabled: true`** (the auth linchpin).
- `npx cap add android && npx cap add ios` (both committed; iOS folder builds later).
- Icons/splash from existing logos via `@capacitor/assets`; StatusBar color = brand green; Android back-button handling (App plugin: back navigates router, exits at root).
- Native detection: `Capacitor.isNativePlatform()` guard hides install banner/menu item, skips sw registration, skips manifest/apple meta.

### Phase C — Auth path through the app
- Server: extend the prod origin check in send-otp/verify-otp to also accept `capacitor://localhost` + `https://localhost` (keep strict host match for everything else).
- Device test the full loop: Turnstile render (localhost hostname) → send-otp → cookie set via native jar → `/api/auth/me` persists across app restarts → logout clears.
- **Turnstile fallback if it misbehaves in the WebView** (decide only if needed): exempt requests carrying a valid app attestation… simplest pragmatic fallback = invisible-mode widget; last resort = app-build flag exempting Turnstile while keeping IP/phone rate limits (documented risk).

### Phase D — Native value (the Apple 4.2 case without push)
- `@capacitor/share` — event sharing uses the native share sheet in-app.
- Native add-to-calendar (community calendar plugin or ICS intent) wired into the existing calendar-add action.
- `@capacitor/haptics` — light impact on carousel settle + publish/delete confirmations.
- Safe-area audit on devices (notches; Capacitor 8 Android edge-to-edge), keyboard behavior on the OTP inputs.

### Phase E — Android release
- Google Play Console account (**$25 one-time**, you), signing keystore (generated + stored safely), AAB build, **internal testing track** first.
- Store listing (you + me): Hebrew description, screenshots, feature graphic; **privacy policy page** — required by Play & Apple; the site has terms-of-service but no privacy policy → add `/privacy` page (content yours, I draft).
- Data-safety form: phone-number auth + PostHog analytics declared.

### Phase F — iOS (when account/Mac ready)
- Apple Developer (**$99/yr**), build via Codemagic free tier or any Mac (Xcode 16+), TestFlight, App Review. Review notes pre-written addressing 4.2 (native share/calendar/haptics, community-specific app). Universal links (AASA + assetlinks.json) as a follow-up so shared `galiluz.co.il` links open the app.

## Effort & risks

- A+B ≈ 2–4 days, C ≈ 2–3 days (device testing heavy), D ≈ 2–3 days, E ≈ 2 days + Play review (~1–3 days). iOS +2–3 days when unblocked.
- **Risks:** Apple 4.2 rejection without push — medium; mitigation = Phase D + review notes; push is the v2 answer if rejected. Turnstile-in-WebView — medium; fallback in Phase C. CapacitorHttp cookie edge cases (logout deletion quirks documented in community) — low; tested explicitly in C.
- **Your prerequisites:** Play account ($25), privacy-policy sign-off, app-store listing copy approvals. Later: Apple account + build access.

## Verification
Per phase: web build + tests stay green (CI); `npm run build:app && npx cap sync android` produces a runnable debug APK in Android Studio emulator; auth loop + schedule browsing + event modal + publisher portal all verified on-device; Lighthouse-style manual pass for safe areas/RTL in the WebView.

Sources: [Announcing Capacitor 8](https://ionic.io/blog/announcing-capacitor-8) · [Capacitor 8 update guide](https://capacitorjs.com/docs/updating/8-0) · [CapacitorCookies/Http guide](https://ionicacademy.com/capacitorcookies-and-capacitorhttp/) · [Cookie auth via CapacitorHttp](https://forum.ionicframework.com/t/capacitor-ios-cookie-authentication-capacitor-http/237748)

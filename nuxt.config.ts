// https://nuxt.com/docs/api/configuration/nuxt-config
import { SEO_DEFAULT_DESCRIPTION, SEO_DEFAULT_TITLE, SEO_KEYWORDS_STRING } from './consts/seo.const.js'

export default defineNuxtConfig({
  compatibilityDate: '2025-01-15',

  experimental: {
    appManifest: false,
  },

  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  devServer: {
    port: 3000,
  },
  
  css: ['~/assets/css/main.scss'],
  
  modules: ['@pinia/nuxt', '@vueuse/nuxt'],

  vue: {
    compilerOptions: {
      isCustomElement: (tag) => tag === 'emoji-picker',
      directiveTransforms: {
        tooltip: () => ({ props: [], needRuntime: true }),
      },
    },
  },

  build: {
    transpile: ['floating-vue', '@floating-ui/core', '@floating-ui/dom'],
  },
  
  app: {
    head: {
      title: SEO_DEFAULT_TITLE,
      htmlAttrs: {
        lang: 'he',
        dir: 'rtl',
      },
      meta: [
        { name: 'description', content: SEO_DEFAULT_DESCRIPTION },
        { name: 'keywords', content: SEO_KEYWORDS_STRING },
        { name: 'apple-mobile-web-app-title', content: 'גלילו"ז' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/svg+xml', href: '/logos/galiluz-icon.svg' },
        { rel: 'apple-touch-icon', href: '/icons/pwa-192.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap',
        },
      ],
    },
  },
  
  runtimeConfig: {
    // Private keys (only available on server-side)
    apiSecret: process.env.API_SECRET || '',
    mongodbUri: process.env.MONGODB_URI,
    mongodbDbName: process.env.MONGODB_DB_NAME,
    mongodbCollectionEvents: process.env.MONGODB_COLLECTION_EVENTS || 'events',
    /** When set, wa-bot create API writes here instead of main events collection (for testing). */
    mongodbCollectionEventsWaBot: process.env.MONGODB_COLLECTION_EVENTS_WA_BOT || '',
    mongodbCollectionRawMessages: process.env.MONGODB_COLLECTION_RAW_MESSAGES || 'raw_messages',
    mongodbCollectionPublishers: process.env.MONGODB_COLLECTION_PUBLISHERS || 'publishers',
    mongodbCollectionEventLogs: process.env.MONGODB_COLLECTION_EVENT_LOGS || 'eventLogs',
    mongodbCollectionAuthLogs: process.env.MONGODB_COLLECTION_AUTH_LOGS || 'authLogs',
    mongodbCollectionEventInteractions: process.env.MONGODB_COLLECTION_EVENT_INTERACTIONS || 'eventInteractions',
    mongodbCollectionEventStats: process.env.MONGODB_COLLECTION_EVENT_STATS || 'eventStats',
    mongodbCollectionEventOccurrenceStats: process.env.MONGODB_COLLECTION_EVENT_OCCURRENCE_STATS || 'eventOccurrenceStats',
    mongodbCollectionAccounts: process.env.MONGODB_COLLECTION_ACCOUNTS || 'accounts',
    // Publisher↔account↔role join (multi-tenant RBAC; source of truth for memberships).
    mongodbCollectionMemberships: process.env.MONGODB_COLLECTION_MEMBERSHIPS || 'memberships',
    // Global app settings (key-based), crawler dedup (TTL 21d), and magic-link tokens (TTL).
    mongodbCollectionAppSettings: process.env.MONGODB_COLLECTION_APP_SETTINGS || 'appSettings',
    mongodbCollectionCrawlerMessages: process.env.MONGODB_COLLECTION_CRAWLER_MESSAGES || 'crawlerMessages',
    mongodbCollectionMagicLinks: process.env.MONGODB_COLLECTION_MAGIC_LINKS || 'magicLinks',
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
    cloudinaryFolder: process.env.CLOUDINARY_FOLDER || 'wa-bot-events',
    // Restored for build/SSR parity with pre-refactor (galiluz-web does not use OpenAI; wa-bot has its own).
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    // OTP authentication
    otpSecret: process.env.OTP_SECRET || '',
    // WhatsApp Gateway (Green API bridge) — OTP delivery goes through this service.
    waGatewayUrl: process.env.WA_GATEWAY_URL || '',
    // Pulseem SMS (Direct Send API) — used when the OTP method setting is 'sms'. Optional:
    // only needed once an admin flips OTP delivery to SMS (default stays WhatsApp).
    pulseemApiKey: process.env.PULSEEM_API_KEY || '',
    pulseemFromNumber: process.env.PULSEEM_FROM_NUMBER || '',
    pulseemApiUrl: process.env.PULSEEM_API_URL || 'https://api.pulseem.com',
    // WhatsApp bot (Cloud API) — web registration notifies the approver(s) through it.
    waBotUrl: process.env.WA_BOT_URL || '',
    // Legacy Cloud API creds — no longer used for OTP (kept for parity; wa-bot has its own).
    waCloudAccessToken: process.env.WA_CLOUD_ACCESS_TOKEN || '',
    waPhoneNumberId: process.env.WA_PHONE_NUMBER_ID || '',
    // Notification emails via Zoho SMTP (optional — mailer no-ops when unset)
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: process.env.SMTP_PORT || '465',
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    mailFrom: process.env.MAIL_FROM || '',
    mailTo: process.env.MAIL_TO || '',
    // Cloudflare Turnstile (optional — login captcha disabled when unset)
    turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY || '',
    // Public keys (exposed to client-side)
    public: {
      siteUrl:
        process.env.NUXT_PUBLIC_SITE_URL ||
        process.env.GALILUZ_APP_URL ||
        'https://galiluz.co.il',
      posthogPublicKey: process.env.NUXT_PUBLIC_POSTHOG_PUBLIC_KEY || '',
      posthogHost: process.env.NUXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
      posthogDefaults: process.env.NUXT_PUBLIC_POSTHOG_DEFAULTS || '2026-01-30',
      posthogInDev: process.env.NUXT_PUBLIC_POSTHOG_IN_DEV === 'true',
      turnstileSiteKey: process.env.NUXT_PUBLIC_TURNSTILE_SITE_KEY || '',
    },
  },

  nitro: {
    routeRules: {
      // PostHog reverse proxy: route analytics through our own domain so ad/tracker
      // blockers (which block *.posthog.com) don't drop events. Keep the '/gz-relay'
      // prefix in sync with POSTHOG_PROXY_PREFIX in plugins/posthog.client.js.
      // Static asset bundle (posthog-js, recorder) comes from the EU assets host:
      '/gz-relay/static/**': { proxy: 'https://eu-assets.i.posthog.com/static/**' },
      // Everything else (capture /e, /decide, /flags, session replay /s, …) → EU ingest host:
      '/gz-relay/**': { proxy: 'https://eu.i.posthog.com/**' },
      '/direct': { cache: false },
      '/**': {
        headers: {
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
          // Turnstile's interactive challenge (unlike the passive pass) needs a
          // blob: web worker, WASM compilation, and Cloudflare-hosted styles —
          // hence worker-src blob:, 'wasm-unsafe-eval', and *.cloudflare.com in style-src.
          'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://*.posthog.com https://fonts.googleapis.com https://*.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.cloudflare.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://*.posthog.com https://*.cloudflare.com; worker-src 'self' blob:; frame-src 'self' https://*.cloudflare.com; frame-ancestors 'none'; form-action 'self';",
        },
      },
    },
  },

  // Auto-import configuration
  imports: {
    dirs: ['stores', 'composables', 'utils'],
  },
})

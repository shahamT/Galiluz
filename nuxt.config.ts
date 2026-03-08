// https://nuxt.com/docs/api/configuration/nuxt-config
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

  build: {
    transpile: ['floating-vue', '@floating-ui/core', '@floating-ui/dom'],
  },

  vue: {
    compilerOptions: {
      directiveTransforms: {
        tooltip: () => ({ props: [], needRuntime: true }),
      },
    },
  },
  
  app: {
    head: {
      title: 'גלילו"ז',
      htmlAttrs: {
        lang: 'he',
        dir: 'rtl',
      },
      link: [
        {
          rel: 'icon',
          type: 'image/svg+xml',
          href: '/logos/galiluz-icon.svg',
        },
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
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
    cloudinaryFolder: process.env.CLOUDINARY_FOLDER || 'wa-bot-events',
    // Public keys (exposed to client-side)
    public: {
      posthogPublicKey: process.env.NUXT_PUBLIC_POSTHOG_PUBLIC_KEY || '',
      posthogHost: process.env.NUXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
      posthogDefaults: process.env.NUXT_PUBLIC_POSTHOG_DEFAULTS || '2026-01-30',
      posthogInDev: process.env.NUXT_PUBLIC_POSTHOG_IN_DEV === 'true',
    },
  },

  nitro: {
    // Reject bodies larger than 25 MB at the HTTP layer (upload endpoint allows ~15 MB files as base64)
    maxRequestBodySize: 25 * 1024 * 1024,
    routeRules: {
      '/direct': { cache: false },
      // Static lookup data — no DB call, safe to cache long
      '/api/categories': { cache: { maxAge: 3600 } },
      // Event meta used by social crawlers / OG preview — short cache is fine
      '/api/events/*/meta': { cache: { maxAge: 300 } },
      '/**': {
        headers: {
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
          'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: https://res.cloudinary.com",
            "media-src 'self' https://res.cloudinary.com",
            "connect-src 'self' https://eu.i.posthog.com https://eu.posthog.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; '),
        },
      },
    },
  },

  // Auto-import configuration
  imports: {
    dirs: ['stores', 'composables', 'utils'],
  },
})

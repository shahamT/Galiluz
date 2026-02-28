// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-15',
  
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
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200',
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
    // Restored for build/SSR parity with pre-refactor (galiluz-web does not use OpenAI; wa-bot has its own).
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    // Public keys (exposed to client-side)
    public: {
      posthogPublicKey: process.env.NUXT_PUBLIC_POSTHOG_PUBLIC_KEY || '',
      posthogHost: process.env.NUXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
      posthogDefaults: process.env.NUXT_PUBLIC_POSTHOG_DEFAULTS || '2026-01-30',
      posthogInDev: process.env.NUXT_PUBLIC_POSTHOG_IN_DEV === 'true',
    },
  },

  nitro: {
    routeRules: {
      '/direct': { cache: false },
      '/**': {
        headers: {
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        },
      },
    },
  },

  // Auto-import configuration
  imports: {
    dirs: ['stores', 'composables', 'utils'],
  },
})

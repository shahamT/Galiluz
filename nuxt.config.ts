// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-15',
  
  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  devServer: {
    port: 3000,
  },
  
  css: ['~/assets/css/main.scss'],
  
  modules: ['@pinia/nuxt', '@vueuse/nuxt', 'floating-vue/nuxt'],
  
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
    mongodbCollectionRawMessages: process.env.MONGODB_COLLECTION_RAW_MESSAGES || 'raw_messages',
    mongodbCollectionPublishers: process.env.MONGODB_COLLECTION_PUBLISHERS || 'publishers',
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

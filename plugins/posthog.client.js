import { defineNuxtPlugin } from '#app'
import posthog from 'posthog-js'

// Same-origin path that the Nitro reverse proxy (see nuxt.config.ts routeRules) forwards to
// PostHog. Routing ingestion through our own domain stops ad/tracker blockers (which block
// *.posthog.com) from dropping our analytics. Keep this in sync with the routeRules prefix.
const POSTHOG_PROXY_PREFIX = '/gz-relay'

const noopPosthog = {
  capture: () => {},
  identify: () => {},
}

export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig()
  const runInDev = runtimeConfig.public.posthogInDev === true
  const shouldInit = runtimeConfig.public.posthogPublicKey && (import.meta.env.PROD || runInDev)
  if (!shouldInit) {
    return { provide: { posthog: noopPosthog } }
  }

  const posthogClient = posthog.init(runtimeConfig.public.posthogPublicKey, {
    // Ingest through our own domain (proxied to posthogHost) so blockers can't drop events.
    // api_host is the CURRENT origin so each served domain proxies through itself.
    api_host: `${window.location.origin}${POSTHOG_PROXY_PREFIX}`,
    ui_host: runtimeConfig.public.posthogHost, // keep "open in PostHog" links pointing at the app
    defaults: runtimeConfig.public.posthogDefaults,
    capture_pageview: false, // we capture pageviews in router.afterEach to include SPA navigations
    capture_pageleave: true, // pageleave is gated on pageview capture — enable it explicitly (bounce/session accuracy)
  })

  const router = useRouter()
  router.afterEach((to) => {
    const url = typeof window !== 'undefined' ? window.location.origin + to.fullPath : to.fullPath
    posthogClient.capture('$pageview', { $current_url: url })
  })

  return {
    provide: {
      posthog: posthogClient,
    },
  }
})

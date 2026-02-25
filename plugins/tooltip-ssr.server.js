/**
 * Register a no-op v-tooltip directive for SSR so ssrGetDirectiveProps does not read getSSRProps from undefined.
 * floating-vue is loaded only on the client (floating-vue-config.client.js), so on the server the directive is missing.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('tooltip', {
    getSSRProps: () => ({}),
  })
})

/**
 * Register floating-vue and set defaults (replaces floating-vue/nuxt module;
 * styles are bundled via ~/assets/css/main.scss).
 */
import FloatingVue from 'floating-vue'
import { options } from 'floating-vue'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(FloatingVue)
  options.distance = 9
})

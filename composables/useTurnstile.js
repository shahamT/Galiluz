/**
 * Cloudflare Turnstile loader (explicit rendering).
 * No-ops entirely when NUXT_PUBLIC_TURNSTILE_SITE_KEY is unset — the login
 * works without a captcha in that case (server skips verification too).
 */

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let scriptPromise = null

function loadScript() {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => { scriptPromise = null; reject(new Error('turnstile script failed to load')) }
    document.head.appendChild(s)
  })
  return scriptPromise
}

export function useTurnstile() {
  const config = useRuntimeConfig()
  const siteKey = config.public.turnstileSiteKey || ''
  const enabled = !!siteKey && import.meta.client

  /**
   * Render the widget into el. Returns the widgetId (or null when disabled/failed).
   * onToken(token) fires on success; onExpire() when the token expires or errors.
   */
  async function render(el, { onToken, onExpire }) {
    if (!enabled || !el) return null
    try {
      await loadScript()
      return window.turnstile.render(el, {
        sitekey: siteKey,
        language: 'he',
        theme: 'light',
        callback: onToken,
        'expired-callback': onExpire,
        'error-callback': onExpire,
      })
    } catch (err) {
      console.error('[Turnstile]', err?.message || err)
      return null
    }
  }

  /** Tokens are single-use — reset after every send attempt to get a fresh one. */
  function reset(widgetId) {
    if (!enabled || widgetId === null || widgetId === undefined) return
    try { window.turnstile?.reset(widgetId) } catch { /* widget gone */ }
  }

  return { enabled, render, reset }
}

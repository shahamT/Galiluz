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
  // Dev is silently exempt (server skips verification there too) — the widget
  // only runs in production builds with a configured site key.
  const enabled = !!siteKey && import.meta.client && !import.meta.dev

  /**
   * Render the widget into el. Returns the widgetId (or null when disabled/failed).
   * onToken(token) fires on success; onExpire() when the token expires;
   * onError(code) fires on a widget error (the code is also logged + the token cleared).
   */
  async function render(el, { onToken, onExpire, onError }) {
    if (!enabled || !el) return null
    try {
      await loadScript()
      return window.turnstile.render(el, {
        sitekey: siteKey,
        language: 'he',
        theme: 'light',
        callback: onToken,
        'expired-callback': onExpire,
        // Surface the error code instead of silently clearing the token and
        // leaving the send button disabled forever. Common code: 110200 =
        // "domain not allowed" — the production hostname is missing from the
        // widget's allowed-hostnames list in the Cloudflare dashboard.
        // Returning falsy lets Turnstile auto-retry recoverable errors.
        'error-callback': (code) => {
          console.error('[Turnstile] widget error code:', code)
          onError?.(code)
          onExpire?.()
        },
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

/**
 * Cloudflare Turnstile loader (explicit rendering).
 * No-ops entirely when NUXT_PUBLIC_TURNSTILE_SITE_KEY is unset — the login
 * works without a captcha in that case (server skips verification too).
 */

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

// If no token arrives within this window, treat it as a failure. Catches the silent cases —
// a blocked/hung script or a challenge that never completes (ad-blocker, in-app webview) —
// which otherwise emit no signal and leave the submit button disabled with no explanation.
const CHALLENGE_TIMEOUT_MS = 15000

let scriptPromise = null
let challengeTimer = null

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
    clearTimeout(challengeTimer)
    let settled = false
    let myTimer = null
    // Fires once on a terminal failure (timeout / blocked script) — never throws, lets the
    // page show a clear message instead of leaving the button silently disabled.
    const fail = (code) => {
      if (settled) return
      settled = true
      clearTimeout(myTimer)
      onError?.(code)
    }
    // Arm BEFORE loading so a hung/blocked script also resolves to a failure.
    myTimer = setTimeout(() => fail('timeout'), CHALLENGE_TIMEOUT_MS)
    challengeTimer = myTimer
    try {
      await loadScript()
      return window.turnstile.render(el, {
        sitekey: siteKey,
        language: 'he',
        theme: 'light',
        // Resilience: let Turnstile auto-recover transient blips on its own.
        retry: 'auto',
        'retry-interval': 8000,
        'refresh-expired': 'auto',
        callback: (token) => { settled = true; clearTimeout(myTimer); onToken?.(token) },
        'expired-callback': onExpire,
        // Recoverable codes auto-retry; just clear the token and let the timeout above be the
        // terminal signal (so we don't flash an error on a blip that would self-heal).
        'error-callback': (code) => {
          console.error('[Turnstile] widget error code:', code)
          onExpire?.()
        },
      })
    } catch (err) {
      // Script blocked/failed to load (ad-blocker, in-app webview, network) — surface it.
      console.error('[Turnstile]', err?.message || err)
      fail('load_failed')
      return null
    }
  }

  /** Tokens are single-use — reset after every send attempt to get a fresh one. */
  function reset(widgetId) {
    if (!enabled || widgetId === null || widgetId === undefined) return
    clearTimeout(challengeTimer)
    try { window.turnstile?.reset(widgetId) } catch { /* widget gone */ }
  }

  /** Remove a widget entirely — call before its host element unmounts (e.g. a
   *  multi-step form that re-renders the widget into a different element per step). */
  function remove(widgetId) {
    if (!enabled || widgetId === null || widgetId === undefined) return
    clearTimeout(challengeTimer)
    try { window.turnstile?.remove(widgetId) } catch { /* already gone */ }
  }

  return { enabled, render, reset, remove }
}

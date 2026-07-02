export function useAuth() {
  const authStore = useAuthStore()

  async function sendOtp(phone, turnstileToken = '') {
    return $fetch('/api/auth/send-otp', { method: 'POST', body: { phone, turnstileToken } })
  }

  async function verifyOtp(phone, otp) {
    // Server sets the HttpOnly session cookie (for publishers, and for staff still in the
    // passkey-enrollment grace window). Staff WITH a passkey get no session yet — they return
    // { mfaRequired, authOptions } and the caller runs the passkey step (verifyPasskey).
    const res = await $fetch('/api/auth/verify-otp', { method: 'POST', body: { phone, otp } })
    if (res.mfaRequired) return res
    authStore.login(res.user)
    return res
  }

  async function verifyPasskey(authOptions) {
    // Browser-only WebAuthn ceremony — dynamic import keeps it out of the SSR bundle.
    const { startAuthentication } = await import('@simplewebauthn/browser')
    const assertion = await startAuthentication({ optionsJSON: authOptions })
    const res = await $fetch('/api/auth/verify-passkey', { method: 'POST', body: { response: assertion } })
    authStore.login(res.user)
    return res
  }

  async function registerPasskey(deviceName = '') {
    const { startRegistration } = await import('@simplewebauthn/browser')
    const options = await $fetch('/api/auth/passkey/register-options', { method: 'POST' })
    const attestation = await startRegistration({ optionsJSON: options })
    return $fetch('/api/auth/passkey/register-verify', { method: 'POST', body: { response: attestation, deviceName } })
  }

  async function listPasskeys() {
    return $fetch('/api/auth/passkey/credentials')
  }

  // Mint a short-lived, single-use cross-device enrollment link (open it on the new device to
  // enroll that device's own passkey). Returns { url, expiresAt }.
  async function createEnrollLink() {
    return $fetch('/api/auth/passkey/enroll-link', { method: 'POST' })
  }

  async function deletePasskey(id) {
    return $fetch(`/api/auth/passkey/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  async function listMyAccounts() {
    return $fetch('/api/auth/accounts')
  }

  async function selectAccount(accountId) {
    const res = await $fetch('/api/auth/select-account', { method: 'POST', body: { accountId } })
    authStore.login(res.user)
    return res
  }

  async function logout() {
    // Cookie is sent automatically; server clears it
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    authStore.logout()
  }

  async function checkAuth() {
    // Cookie is sent automatically by browser
    try {
      const user = await $fetch('/api/auth/me')
      authStore.setUser(user)
      return true
    } catch {
      authStore.logout()
      return false
    }
  }

  return { sendOtp, verifyOtp, verifyPasskey, registerPasskey, listPasskeys, deletePasskey, createEnrollLink, listMyAccounts, selectAccount, logout, checkAuth }
}

export function useAuth() {
  const authStore = useAuthStore()

  async function sendOtp(phone) {
    return $fetch('/api/auth/send-otp', { method: 'POST', body: { phone } })
  }

  async function verifyOtp(phone, otp) {
    // Server sets HttpOnly cookie; we only receive user info back
    const res = await $fetch('/api/auth/verify-otp', { method: 'POST', body: { phone, otp } })
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

  return { sendOtp, verifyOtp, logout, checkAuth }
}

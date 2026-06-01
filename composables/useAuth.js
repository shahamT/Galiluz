export function useAuth() {
  const authStore = useAuthStore()

  async function sendOtp(phone) {
    const res = await $fetch('/api/auth/send-otp', {
      method: 'POST',
      body: { phone },
    })
    return res
  }

  async function verifyOtp(phone, otp) {
    const res = await $fetch('/api/auth/verify-otp', {
      method: 'POST',
      body: { phone, otp },
    })
    authStore.login(res.token, res.user)
    return res
  }

  async function logout() {
    const token = authStore.getToken()
    if (token) {
      await $fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    authStore.logout()
  }

  async function checkAuth() {
    const token = authStore.getToken()
    if (!token) return false
    try {
      const user = await $fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      authStore.setUser(user)
      return true
    } catch {
      authStore.logout()
      return false
    }
  }

  return { sendOtp, verifyOtp, logout, checkAuth }
}

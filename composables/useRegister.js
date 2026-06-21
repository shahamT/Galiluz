/**
 * Public publisher-registration API calls. Thin $fetch wrappers — unlike useAuth,
 * these never touch the auth store (registration issues no session; the registrant
 * stays pending until a manager approves).
 */
export function useRegister() {
  /** Classify a phone for eligibility: { status: 'new'|'already_approved'|'pending_exists'|'ghost_upgrade' }. */
  async function checkPhone(phone) {
    return $fetch('/api/publishers/register/check', { method: 'POST', body: { phone } })
  }

  /** Submit details + send the verification OTP. */
  async function startRegistration(payload) {
    return $fetch('/api/publishers/register/start', { method: 'POST', body: payload })
  }

  /** Verify the OTP and finalize the pending registration. */
  async function verifyRegistration(phone, otp) {
    return $fetch('/api/publishers/register/verify', { method: 'POST', body: { phone, otp } })
  }

  return { checkPhone, startRegistration, verifyRegistration }
}
